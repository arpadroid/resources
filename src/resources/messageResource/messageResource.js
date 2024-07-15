/**
 * @typedef {import('../../types').MessageInterface} MessageInterface
 * @typedef {import('./messageResourceInterface').MessageResourceInterface} MessageResourceInterface
 * @typedef {import('../../types').AbstractContentInterface} AbstractContentInterface
 */
import { ObserverTool, mergeObjects } from '@arpadroid/tools';

class MessageResource {
    /** @type {Record<string, MessageInterface>} */
    _messagesById = {};

    /** @type {(property: string, value: unknown) => void} signal */
    signal;
    /** @type {(property: string, callback: () => unknown) => () => void} listen */
    listen;

    constructor(config = {}) {
        ObserverTool.mixin(this);
        this.setConfig(config);
        this._initialize();
    }

    /**
     * Sets the messenger config.
     * @param {MessageResourceInterface} config
     * @returns {MessageResource}
     */
    setConfig(config = {}) {
        this._config = mergeObjects(this.getDefaultConfig(), config);
        this._messages = this._config.messages ?? [];
        return this;
    }

    /**
     * Returns the messenger config.
     * @returns {MessageResourceInterface}
     */
    getDefaultConfig() {
        return {
            messages: []
        };
    }

    _initialize() {
        this._initializeMessages();
    }

    _initializeMessages() {
        this.addMessages(this._messages);
    }

    getById(id) {
        return this._messagesById[id];
    }

    /**
     * Adds a message.
     * @param {MessageInterface} message
     * @param {boolean} sendUpdate
     * @returns {MessageInterface}
     */
    addMessage(message = {}, sendUpdate = true) {
        message.id = message?.node?.id || message?.id || Symbol('UID');
        if (typeof message.type === 'undefined') {
            message.type = 'info';
        }
        message.resource = this;
        this._messagesById[message.id] = message;
        this._messages.push(message);
        if (sendUpdate) {
            this.signal('ADD_MESSAGE', message);
        }
        return this._messagesById[message.id];
    }

    updateMessage(id, config) {
        const message = this._messagesById[id];
        if (message) {
            mergeObjects(message, config);
            message?.node?.setConfig(message);
            message?.reRender();
        }
    }

    registerMessage(config = {}, node) {
        const id = node?.id || config?.id;
        if (!this._messagesById[id]) {
            return this.addMessage({...config, node}, false);
        }
        return this._messagesById[id];
    }

    /**
     * Adds an info message.
     * @param {AbstractContentInterface} message
     * @param {MessageInterface} config
     * @returns {MessageInterface}
     */
    info(message, config = {}) {
        config.content = message;
        config.type = 'info';
        return this.addMessage(config);
    }

    /**
     * Adds an error message.
     * @param {AbstractContentInterface} message
     * @param {MessageInterface} config
     * @returns {MessageInterface}
     */
    error(message, config = {}) {
        config.content = message;
        config.type = 'error';
        return this.addMessage(config);
    }

    /**
     * Adds an warning message.
     * @param {AbstractContentInterface} message
     * @param {MessageInterface} config
     * @returns {MessageInterface}
     */
    warning(message, config = {}) {
        config.content = message;
        config.type = 'warning';
        return this.addMessage(config);
    }

    /**
     * Adds an success message.
     * @param {AbstractContentInterface} message
     * @param {MessageInterface} config
     * @returns {MessageInterface}
     */
    success(message, config = {}) {
        config.content = message;
        config.type = 'success';
        return this.addMessage(config);
    }

    /**
     * Adds messages to the messenger.
     * @param {MessageInterface[]} messages
     * @returns {MessageResource}
     * @throws {Error} If messages is not an array.
     */
    addMessages(messages = []) {
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array.');
        }
        messages.forEach(message => this.addMessage(message));
        return this;
    }

    /**
     * Deletes all messages.
     * @returns {MessageResource}
     */
    deleteMessages() {
        this._messages = [];
        this._messagesById = {};
        this.signal('DELETE_MESSAGES', this._messages);
        return this;
    }

    getMessages() {
        return this._messages;
    }

    /**
     * Deletes a message.
     * @param {MessageInterface} message
     * @param {boolean} sendUpdate
     */
    deleteMessage(message, sendUpdate = true) {
        if (this._messagesById[message.id]) {
            const index = this._messages.findIndex(({ id }) => id === message.id);
            if (index > -1) {
                this._messages.splice(index, 1);
            }
            delete this._messagesById[message.id];
            if (sendUpdate) {
                this.signal('DELETE_MESSAGE', message);
            }
        }
    }
}

export default MessageResource;
