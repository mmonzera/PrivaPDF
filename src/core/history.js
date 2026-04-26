/**
 * History Manager — Command pattern for undo/redo.
 * Critical for legal document editing where every action must be reversible.
 */
import { bus, Events } from './events.js';

class Command {
  /**
   * @param {Object} opts
   * @param {string} opts.description — Human-readable description
   * @param {Function} opts.execute — Do the action
   * @param {Function} opts.undo — Reverse the action
   */
  constructor({ description, execute, undo }) {
    this.description = description;
    this.execute = execute;
    this.undo = undo;
    this.timestamp = Date.now();
  }
}

class HistoryManager {
  constructor(maxSize = 50) {
    /** @type {Command[]} */
    this._undoStack = [];
    /** @type {Command[]} */
    this._redoStack = [];
    this._maxSize = maxSize;
  }

  /**
   * Execute a command and push it to history.
   * @param {Object} commandDef — { description, execute, undo }
   */
  execute(commandDef) {
    const command = new Command(commandDef);
    command.execute();

    this._undoStack.push(command);
    if (this._undoStack.length > this._maxSize) {
      this._undoStack.shift();
    }

    // Clear redo stack on new action
    this._redoStack = [];

    bus.emit(Events.HISTORY_CHANGED, this.status);
  }

  /** Undo the last command. */
  undo() {
    if (this._undoStack.length === 0) return false;

    const command = this._undoStack.pop();
    command.undo();
    this._redoStack.push(command);

    bus.emit(Events.HISTORY_CHANGED, this.status);
    return true;
  }

  /** Redo the last undone command. */
  redo() {
    if (this._redoStack.length === 0) return false;

    const command = this._redoStack.pop();
    command.execute();
    this._undoStack.push(command);

    bus.emit(Events.HISTORY_CHANGED, this.status);
    return true;
  }

  /** Clear all history. */
  clear() {
    this._undoStack = [];
    this._redoStack = [];
    bus.emit(Events.HISTORY_CHANGED, this.status);
  }

  get canUndo() {
    return this._undoStack.length > 0;
  }

  get canRedo() {
    return this._redoStack.length > 0;
  }

  get status() {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoCount: this._undoStack.length,
      redoCount: this._redoStack.length,
      lastAction: this._undoStack.length > 0
        ? this._undoStack[this._undoStack.length - 1].description
        : null,
    };
  }
}

export const history = new HistoryManager();
export default history;
