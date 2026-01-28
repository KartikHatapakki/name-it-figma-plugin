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
    if (newNode && newNode.type !== "DOCUMENT" && newNode.type !== "PAGE") {
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
        figma.closePlugin();
        break;
      case "close":
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
    }
  };
  var isZooming = false;
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
      const width = maxX - minX;
      const height = maxY - minY;
      const targetX = minX + width / 2;
      const targetY = minY + height / 2;
      const contextMultiplier = 2;
      const minVisibleSize = 400;
      const virtualWidth = Math.max(width * contextMultiplier, minVisibleSize);
      const virtualHeight = Math.max(height * contextMultiplier, minVisibleSize);
      const viewportBounds = figma.viewport.bounds;
      const zoomX = viewportBounds.width / virtualWidth;
      const zoomY = viewportBounds.height / virtualHeight;
      const targetZoom = Math.min(zoomX, zoomY, 1);
      const startCenter = figma.viewport.center;
      const startZoom = figma.viewport.zoom;
      const steps = 12;
      const duration = 25;
      for (let i = 1; i <= steps; i++) {
        const t = easeOutCubic(i / steps);
        figma.viewport.center = {
          x: startCenter.x + (targetX - startCenter.x) * t,
          y: startCenter.y + (targetY - startCenter.y) * t
        };
        figma.viewport.zoom = startZoom + (targetZoom - startZoom) * t;
        await new Promise((resolve) => setTimeout(resolve, duration));
      }
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
      const targetX = bounds.x + bounds.width / 2;
      const targetY = bounds.y + bounds.height / 2;
      const minVisibleSize = 800;
      const virtualWidth = Math.max(bounds.width * 3, minVisibleSize);
      const virtualHeight = Math.max(bounds.height * 3, minVisibleSize);
      const viewportBounds = figma.viewport.bounds;
      const zoomX = viewportBounds.width / virtualWidth;
      const zoomY = viewportBounds.height / virtualHeight;
      const targetZoom = Math.max(0.15, Math.min(zoomX, zoomY, 0.5));
      const startCenter = figma.viewport.center;
      const startZoom = figma.viewport.zoom;
      const steps = 12;
      const duration = 25;
      for (let i = 1; i <= steps; i++) {
        const t = easeOutCubic(i / steps);
        const newX = startCenter.x + (targetX - startCenter.x) * t;
        const newY = startCenter.y + (targetY - startCenter.y) * t;
        const newZoom = startZoom + (targetZoom - startZoom) * t;
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
