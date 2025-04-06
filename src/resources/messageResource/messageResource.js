/**
 * @typedef {import('./messageResource.types').MessageResourceConfigType} MessageResourceConfigType
 * @typedef {import('./messageResource.types').MessageType} MessageType
 * @typedef {import('@arpadroid/tools/src/common.types').AbstractContentInterface} AbstractContentInterface
 */
import { observerMixin, mergeObjects, dummySignal, dummyListener, getObjectId } from '@arpadroid/tools';

class MessageResource {
    /** @type {Record<string, MessageType>} */
    _messagesById = {};

    constructor(config = {}) {
        this.signal = dummySignal;
        this.on = dummyListener;
        observerMixin(this);
        this.setConfig(config);
        this._initialize();
    }

    /**
     * Sets the messenger config.
     * @param {MessageResourceConfigType} config
     * @returns {MessageResource}
     */
    setConfig(config = {}) {
        this._config = mergeObjects(this.getDefaultConfig(), config);
        this._messages = this._config.messages ?? [];
        return this;
    }

    /**
     * Returns the messenger config.
     * @returns {MessageResourceConfigType}
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

    /**
     * Returns a message by id.
     * @param {string} id
     * @returns {MessageType}
     */
    getById(id) {
        return this._messagesById[id];
    }

    /**
     * Adds a message.
     * @param {MessageType} message
     * @param {boolean} sendUpdate
     * @returns {MessageType}
     */
    addMessage(message = {}, sendUpdate = true) {
        message.id = message?.node?.id || message?.id || 'message-' + getObjectId(message) || 'message-' + Math.random();
        if (typeof message.type === 'undefined') {
            message.type = 'info';
        }
        message.resource = this;
        this._messagesById[String(message.id)] = message;
        this._messages?.push(message);
        if (sendUpdate) {
            this.signal('add_message', message);
        }
        return this._messagesById[String(message.id)];
    }

    /**
     * Updates a message.
     * @param {string} id
     * @param {MessageType} config
     */
    updateMessage(id, config) {
        const message = this._messagesById[id];
        if (message) {
            mergeObjects(message, config);
            message?.node?.setConfig(message);
            message?.node?.reRender();
        }
    }

    /**
     * Registers a message.
     * @param {MessageType} config
     * @param {HTMLElement} node
     * @returns {MessageType}
     */
    registerMessage(config = {}, node) {
        const id = String(node?.id || config?.id);
        if (!this._messagesById[id]) {
            return this.addMessage({ ...config, node }, false);
        }
        return this._messagesById[id];
    }

    /**
     * Adds an info message.
     * @param {AbstractContentInterface} message
     * @param {MessageType} config
     * @returns {MessageType}
     */
    info(message, config = {}) {
        config.content = message;
        config.type = 'info';
        return this.addMessage(config);
    }

    /**
     * Adds an error message.
     * @param {AbstractContentInterface} message
     * @param {MessageType} config
     * @returns {MessageType}
     */
    error(message, config = {}) {
        config.content = message;
        config.type = 'error';
        return this.addMessage(config);
    }

    /**
     * Adds an warning message.
     * @param {AbstractContentInterface} message
     * @param {MessageType} config
     * @returns {MessageType}
     */
    warning(message, config = {}) {
        config.content = message;
        config.type = 'warning';
        return this.addMessage(config);
    }

    /**
     * Adds an success message.
     * @param {AbstractContentInterface} message
     * @param {MessageType} config
     * @returns {MessageType}
     */
    success(message, config = {}) {
        config.content = message;
        config.type = 'success';
        return this.addMessage(config);
    }

    /**
     * Adds messages to the messenger.
     * @param {MessageType[]} messages
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
        /** @type {MessageType[]} */
        this._messages = [];
        this._messagesById = {};
        this.signal('delete_messages', this._messages);
        return this;
    }

    getMessages() {
        return this._messages;
    }

    /**
     * Deletes a message.
     * @param {MessageType} message
     * @param {boolean} sendUpdate
     */
    deleteMessage(message, sendUpdate = true) {
        const id = String(message.id);
        if (this._messagesById[id] && this._messages) {
            const index = this._messages?.findIndex(({ id }) => id === message.id);
            if (index > -1) {
                this._messages.splice(index, 1);
            }
            delete this._messagesById[id];
            if (sendUpdate) {
                this.signal('delete_message', message);
            }
        }
    }
}

export default MessageResource;
