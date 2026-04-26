/**
 * Tool Manager — State machine for editor tools.
 */
import { bus, Events } from '../core/events.js';
import { state } from '../core/state.js';

export const TOOLS = {
  SELECT: 'select',
  EDIT: 'edit',
  REDACT: 'redact',
  TEXT: 'text',
};

/**
 * Set the active tool.
 * @param {string} toolName
 */
export function setTool(toolName) {
  if (!Object.values(TOOLS).includes(toolName)) return;
  const prevTool = state.activeTool;
  if (prevTool === toolName) return;

  // Exit edit mode if switching away
  if (prevTool === TOOLS.EDIT && toolName !== TOOLS.EDIT) {
    bus.emit(Events.EDIT_MODE_EXIT);
  }

  state.activeTool = toolName;
  bus.emit(Events.TOOL_CHANGED, { tool: toolName, prevTool });

  // Enter edit mode if switching to edit
  if (toolName === TOOLS.EDIT) {
    bus.emit(Events.EDIT_MODE_ENTER);
  }
}

/**
 * Get cursor CSS class for current tool.
 * @param {string} tool
 * @returns {string}
 */
export function getToolCursor(tool) {
  return {
    [TOOLS.SELECT]: 'tool-select',
    [TOOLS.EDIT]: 'tool-edit',
    [TOOLS.REDACT]: 'tool-rect',
    [TOOLS.TEXT]: 'tool-text',
  }[tool] || 'tool-select';
}

/**
 * Get display name for a tool.
 * @param {string} tool
 * @returns {string}
 */
export function getToolName(tool) {
  return {
    [TOOLS.SELECT]: 'Select',
    [TOOLS.EDIT]: 'Edit',
    [TOOLS.REDACT]: 'Redact',
    [TOOLS.TEXT]: 'Text',
  }[tool] || tool;
}
