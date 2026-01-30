"use strict";
(() => {
  // src/plugin/code.ts
  function getLayerType(node) {
    switch (node.type) {
      case "FRAME":
      case "SECTION":
        return "frame";
      case "GROUP":
        return "group";
      case "COMPONENT":
      case "COMPONENT_SET":
        return "component";
      case "INSTANCE":
        return "instance";
      case "TEXT":
        return "text";
      case "VECTOR":
      case "BOOLEAN_OPERATION":
        return "vector";
      case "LINE":
        return "line";
      case "RECTANGLE":
        if ("fills" in node && Array.isArray(node.fills)) {
          const hasImageFill = node.fills.some((fill) => fill.type === "IMAGE");
          if (hasImageFill)
            return "image";
        }
        return "rectangle";
      case "ELLIPSE":
        return "ellipse";
      case "POLYGON":
        return "polygon";
      case "STAR":
        return "star";
      default:
        return "other";
    }
  }
  function selectSibling(direction) {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1)
      return;
    const currentNode = selection[0];
    const parent = currentNode.parent;
    if (!parent || !("children" in parent))
      return;
    const siblings = parent.children;
    const currentIndex = siblings.indexOf(currentNode);
    if (currentIndex === -1)
      return;
    let newIndex;
    if (direction === "next") {
      newIndex = currentIndex + 1;
      if (newIndex >= siblings.length) {
        newIndex = 0;
      }
    } else {
      newIndex = currentIndex - 1;
      if (newIndex < 0) {
        newIndex = siblings.length - 1;
      }
    }
    const newNode = siblings[newIndex];
    if (newNode) {
      figma.currentPage.selection = [newNode];
    }
  }
  figma.showUI(__html__, {
    width: 280,
    height: 52,
    themeColors: true
  });
  function getSelectionInfo() {
    const selection = figma.currentPage.selection;
    let layerType = "other";
    if (selection.length === 1) {
      layerType = getLayerType(selection[0]);
    } else if (selection.length > 1) {
      const types = new Set(selection.map((node) => getLayerType(node)));
      layerType = types.size === 1 ? getLayerType(selection[0]) : "mixed";
    }
    return {
      count: selection.length,
      names: selection.map((node) => node.name),
      hasLocked: selection.some((node) => node.locked),
      nodeIds: selection.map((node) => node.id),
      layerType
    };
  }
  function sendSelectionToUI() {
    const info = getSelectionInfo();
    figma.ui.postMessage({
      type: "selection",
      count: info.count,
      names: info.names,
      hasLocked: info.hasLocked,
      nodeIds: info.nodeIds,
      layerType: info.layerType
    });
  }
  sendSelectionToUI();
  cleanupStaleHighlights();
  figma.on("selectionchange", () => {
    sendSelectionToUI();
  });
  figma.ui.onmessage = (msg) => {
    const selection = figma.currentPage.selection;
    switch (msg.type) {
      case "rename":
        if (msg.name !== void 0 && msg.name.length > 0) {
          for (const node of selection) {
            if (!node.locked) {
              node.name = msg.name;
            }
          }
        }
        break;
      case "cancel":
        if (msg.originalNames && msg.originalNames.length === selection.length) {
          selection.forEach((node, index) => {
            if (!node.locked && msg.originalNames) {
              node.name = msg.originalNames[index];
            }
          });
        }
        removeHighlightSync();
        figma.closePlugin();
        break;
      case "close":
        removeHighlightSync();
        figma.closePlugin();
        break;
      case "init":
        sendSelectionToUI();
        break;
      case "selectNext":
        selectSibling("next");
        break;
      case "selectPrevious":
        selectSibling("previous");
        break;
      case "enterFrame":
        enterFrame();
        break;
      case "getLayerPositions":
        getLayerPositions();
        break;
      case "batchRename":
        if (msg.renames) {
          handleBatchRename(msg.renames);
        }
        break;
      case "resizeUI":
        if (msg.width && msg.height) {
          figma.ui.resize(msg.width, msg.height);
        }
        break;
      case "zoomToLayer":
        if (msg.nodeId) {
          zoomToLayer(msg.nodeId);
        }
        break;
      case "zoomToSelection":
        zoomToSelection();
        break;
      case "highlightLayer":
        if (msg.nodeId) {
          showLayerHighlight(msg.nodeId);
        }
        break;
      case "removeHighlight":
        removeHighlightSync();
        break;
    }
  };
  var isZooming = false;
  var lastZoomTarget = null;
  var HIGHLIGHT_NODE_NAME = "__name-it-highlight__";
  function removeAllHighlights() {
    try {
      const storedId = figma.root.getPluginData("highlightNodeId");
      if (storedId && storedId.length > 0) {
        const node = figma.getNodeById(storedId);
        if (node)
          node.remove();
        figma.root.setPluginData("highlightNodeId", "");
      }
    } catch (_) {
    }
    try {
      const toRemove = [];
      for (const child of figma.currentPage.children) {
        if (child.name === HIGHLIGHT_NODE_NAME || child.name.includes("name-it-highlight")) {
          toRemove.push(child);
        }
      }
      for (const node of toRemove) {
        try {
          node.remove();
        } catch (_) {
        }
      }
    } catch (_) {
    }
    try {
      const highlights = figma.currentPage.findAll(
        (node) => node.name === HIGHLIGHT_NODE_NAME || node.name.includes("name-it-highlight")
      );
      for (const node of highlights) {
        try {
          node.remove();
        } catch (_) {
        }
      }
    } catch (_) {
    }
    for (const page of figma.root.children) {
      if (page.type === "PAGE") {
        try {
          const toRemove = [];
          for (const child of page.children) {
            if (child.name === HIGHLIGHT_NODE_NAME || child.name.includes("name-it-highlight")) {
              toRemove.push(child);
            }
          }
          for (const node of toRemove) {
            try {
              node.remove();
            } catch (_) {
            }
          }
          const pageHighlights = page.findAll(
            (node) => node.name === HIGHLIGHT_NODE_NAME || node.name.includes("name-it-highlight")
          );
          for (const node of pageHighlights) {
            try {
              node.remove();
            } catch (_) {
            }
          }
        } catch (_) {
        }
      }
    }
  }
  function cleanupStaleHighlights() {
    removeAllHighlights();
  }
  function removeHighlightSync() {
    removeAllHighlights();
  }
  async function showLayerHighlight(nodeId) {
    removeAllHighlights();
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || !("absoluteBoundingBox" in node))
        return;
      const sceneNode = node;
      const bounds = sceneNode.absoluteBoundingBox;
      if (!bounds)
        return;
      const zoom = figma.viewport.zoom;
      const baseStrokeWeight = 4;
      const basePadding = 8;
      const baseCornerRadius = 4;
      const scale = Math.max(0.5, Math.min(8, 1 / zoom));
      const strokeWeight = baseStrokeWeight * scale;
      const padding = basePadding * scale;
      const cornerRadius = baseCornerRadius * scale;
      const highlight = figma.createRectangle();
      figma.currentPage.appendChild(highlight);
      highlight.name = HIGHLIGHT_NODE_NAME;
      highlight.fills = [];
      highlight.strokes = [{ type: "SOLID", color: { r: 0.13, g: 0.77, b: 0.37 } }];
      highlight.strokeWeight = strokeWeight;
      highlight.strokeAlign = "OUTSIDE";
      highlight.cornerRadius = cornerRadius;
      highlight.x = bounds.x - padding;
      highlight.y = bounds.y - padding;
      highlight.resize(bounds.width + padding * 2, bounds.height + padding * 2);
      figma.root.setPluginData("highlightNodeId", highlight.id);
    } catch (_) {
      removeAllHighlights();
    }
  }
  async function shakeViewport() {
    const center = figma.viewport.center;
    const shakeAmount = 8;
    const steps = [
      { x: shakeAmount, y: 0 },
      { x: -shakeAmount, y: 0 },
      { x: shakeAmount / 2, y: 0 },
      { x: -shakeAmount / 2, y: 0 },
      { x: 0, y: 0 }
    ];
    for (const offset of steps) {
      figma.viewport.center = { x: center.x + offset.x, y: center.y + offset.y };
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    figma.viewport.center = center;
  }
  async function zoomToSelection() {
    if (isZooming)
      return;
    isZooming = true;
    try {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        isZooming = false;
        return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of selection) {
        if (node.absoluteBoundingBox) {
          const bounds = node.absoluteBoundingBox;
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.width);
          maxY = Math.max(maxY, bounds.y + bounds.height);
        }
      }
      if (minX === Infinity) {
        isZooming = false;
        return;
      }
      const targetX = (minX + maxX) / 2;
      const targetY = (minY + maxY) / 2;
      const currentCenter = figma.viewport.center;
      const tolerance = 50;
      const alreadyAtTarget = lastZoomTarget && Math.abs(currentCenter.x - targetX) < tolerance && Math.abs(currentCenter.y - targetY) < tolerance;
      if (alreadyAtTarget) {
        await shakeViewport();
        isZooming = false;
        return;
      }
      const startCenter = figma.viewport.center;
      const startZoom = figma.viewport.zoom;
      figma.viewport.scrollAndZoomIntoView(selection);
      const endCenter = figma.viewport.center;
      const endZoom = figma.viewport.zoom;
      figma.viewport.center = startCenter;
      figma.viewport.zoom = startZoom;
      const steps = 15;
      const duration = 20;
      for (let i = 1; i <= steps; i++) {
        const t = easeOutCubic(i / steps);
        figma.viewport.center = {
          x: startCenter.x + (endCenter.x - startCenter.x) * t,
          y: startCenter.y + (endCenter.y - startCenter.y) * t
        };
        figma.viewport.zoom = startZoom + (endZoom - startZoom) * t;
        await new Promise((resolve) => setTimeout(resolve, duration));
      }
      lastZoomTarget = { x: targetX, y: targetY };
    } finally {
      isZooming = false;
    }
  }
  async function zoomToLayer(nodeId) {
    if (isZooming)
      return;
    isZooming = true;
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || !("absoluteBoundingBox" in node)) {
        isZooming = false;
        return;
      }
      const sceneNode = node;
      const bounds = sceneNode.absoluteBoundingBox;
      if (!bounds) {
        isZooming = false;
        return;
      }
      const startCenter = figma.viewport.center;
      const startZoom = figma.viewport.zoom;
      figma.viewport.scrollAndZoomIntoView([sceneNode]);
      const endCenter = figma.viewport.center;
      const endZoom = figma.viewport.zoom * 0.6;
      figma.viewport.center = startCenter;
      figma.viewport.zoom = startZoom;
      const steps = 12;
      const duration = 25;
      for (let i = 1; i <= steps; i++) {
        const t = easeOutCubic(i / steps);
        const newX = startCenter.x + (endCenter.x - startCenter.x) * t;
        const newY = startCenter.y + (endCenter.y - startCenter.y) * t;
        const newZoom = startZoom + (endZoom - startZoom) * t;
        figma.viewport.center = { x: newX, y: newY };
        figma.viewport.zoom = newZoom;
        await new Promise((resolve) => setTimeout(resolve, duration));
      }
    } finally {
      isZooming = false;
    }
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function enterFrame() {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1)
      return;
    const node = selection[0];
    if ("children" in node && node.children.length > 0) {
      figma.currentPage.selection = [...node.children];
    }
  }
  function getLayerPositions() {
    const selection = figma.currentPage.selection;
    const layers = selection.map((node) => {
      let x = 0;
      let y = 0;
      if (node.absoluteBoundingBox) {
        x = node.absoluteBoundingBox.x;
        y = node.absoluteBoundingBox.y;
      } else if ("x" in node && "y" in node) {
        x = node.x;
        y = node.y;
      }
      return {
        id: node.id,
        name: node.name,
        x,
        y,
        type: getLayerType(node)
      };
    });
    figma.ui.postMessage({
      type: "layerPositions",
      layers
    });
  }
  async function handleBatchRename(renames) {
    for (const { nodeId, newName } of renames) {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (node && "name" in node) {
        const sceneNode = node;
        if (!sceneNode.locked) {
          sceneNode.name = newName;
        }
      }
    }
  }
})();
