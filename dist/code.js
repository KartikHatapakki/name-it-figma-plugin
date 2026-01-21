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
    width: 240,
    height: 40,
    themeColors: false
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
    }
  };
  function enterFrame() {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1)
      return;
    const node = selection[0];
    if ("children" in node && node.children.length > 0) {
      figma.currentPage.selection = [...node.children];
    }
  }
})();
