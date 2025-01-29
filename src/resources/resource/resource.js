/**
 * @typedef {import('./resource.types').ResourceConfigType} ResourceConfigType
 * @typedef {import('./resource.types').ResourceResponseType} ResourceResponseType
 * @typedef {import('./resource.types').ResourcePayloadType} ResourcePayloadType
 * @typedef {import('@arpadroid/services').APIService} APIService
 */
import { mergeObjects, observerMixin } from '@arpadroid/tools';
import { getService } from '@arpadroid/context';

/** @type {Record<string, unknown>} */
export const resourceStore = {};

/**
 * Returns a resource from the resource store given its id.
 * @param {string} id
 * @returns {Resource | undefined | unknown}
 */
export function getResource(id) {
    return resourceStore[id];
}

/**
 * Removes a resource from the resource store given its id.
 * @param {string} id
 * @returns {void}
 */
export function removeResource(id) {
    getResource(id) && delete resourceStore[id];
}

class Resource {
    request;
    requestHeaders = null;
    isReady = true;
    hasFailed;
    hasFetched = false;
    pollCount = 0;
    _url;

    /** @type {(property: string, value: unknown) => void} signal */
    signal;

    /** @type {(property: string, callback: () => unknown) => () => void} on */
    on;

    constructor(url, config = {}) {
        /** @type {APIService} */
        this.apiService = getService('apiService');
        this._unsubscribes = [];
        observerMixin(this);
        this.id = config?.id ?? this.constructor.name;
        this._initializePayload = this._initializePayload.bind(this);
        this.setConfig(config);
        this.setUrl(url);
        this._initialize();
        resourceStore[this.id] = this;
    }

    setUrl(url) {
        this._url = url;
        return this;
    }

    setPayload(payload) {
        this._payload = payload;
        return this;
    }

    /**
     * Sets the configuration of the resource.
     * @param {ResourceConfigType | Record<string, never>} config
     * @returns {Resource}
     */
    setConfig(config = {}) {
        /** @type {ResourceInterface} */
        this._config = mergeObjects(this.getDefaultConfig(), config);
        return this;
    }

    /**
     * Returns the default configuration of the resource.
     * @returns {ResourceConfigType}
     */
    getDefaultConfig() {
        return {
            payload: {},
            query: {},
            pollInterval: 5000,
            maxPollCount: 10,
            mode: 'concurrent',
            showLogs: false,
            debounceFetch: 2000
        };
    }

    _initialize() {
        this._initializeProperties();
    }

    _initializeProperties() {
        this._onError = this._onError.bind(this);
        this._onSuccess = this._onSuccess.bind(this);
        this._onComplete = this._onComplete.bind(this);
        this._payload = {};
        if (Object.keys(this._config?.payload ?? {}).length) {
            this._initializePayload(this._config.payload);
        }
    }

    /**
     * Fetching.
     * @param {...any} args
     * @returns {Promise<ResourceResponseType> | undefined}
     */
    fetch(...args) {
        if (this.isReady) {
            this.isReady = false;
            this.signal('ready', false);
            this.signal('fetch');
            if (this._config.mode === 'consecutive') {
                this.request = this.fetchConsecutive(...args);
                return this.request;
            }
            const promises = this.fetchPromises();
            promises.unshift(this._fetch(...args));
            this.request = Promise.all(promises)
                .then(this._onSuccess)
                .catch(this._onError)
                .finally(this._onComplete);
        }
        return this.request;
    }

    /**
     * Fetches the resource consecutively.
     * @param {...any} args
     * @returns {Promise<ResourceResponseType>}
     */
    fetchConsecutive(...args) {
        return this._fetch(...args)
            .then(() =>
                Promise.all(this.fetchPromises())
                    .then(this._onSuccess)
                    .catch(this._onError)
                    .finally(this._onComplete)
            )
            .catch(error => this.onFetchError(error));
    }

    async _fetch() {
        const headers = this.getHeaders();
        return this.apiService
            .fetch(this.getURL(), {
                query: this.getQuery(),
                headers
            })
            .then(async payload => {
                const validResponse = this.validateResourcePayload(payload);
                if (validResponse !== true) {
                    return Promise.reject(validResponse);
                }
                return this._initializePayload(payload, headers);
            });
    }

    /**
     * Sets the fetch function to be used by the resource.
     * @param {Promise<any>} fetch
     */
    setFetch(fetch) {
        this._config.fetch = fetch;
    }

    validateResourcePayload() {
        return true;
    }

    getURL() {
        return this._url;
    }

    /**
     * Returns the headers of the resource.
     * @returns {Headers | undefined}
     */
    getHeaders() {
        return {};
    }

    getQuery() {
        return this._config.query;
    }

    fetchPromises() {
        return [];
    }

    async _initializePayload(response = {}, headers = {}) {
        this._payload = this._getPayload(response);
        this._payload = this._preprocessPayload(this._payload);
        this.requestHeaders = headers;
        this.signal('payload', this._payload);
        return this._payload;
    }

    _getPayload(response) {
        return response?.value?.payload ?? response?.payload ?? response;
    }

    _preprocessPayload(payload) {
        return payload;
    }

    getPayload() {
        return { ...this._payload };
    }

    _onSuccess() {
        this.hasFailed = false;
        return Promise.resolve(this._payload);
    }

    _onError(response = {}) {
        this.hasFailed = true;
        if (this._config.showLogs) {
            console.error('ERROR FETCHING PAYLOAD:', this, response);
        }
        this.signal('ERROR', response);
        return Promise.reject(response);
    }

    _onComplete() {
        setTimeout(() => (this.isReady = true), this._config.debounceFetch);
        this.isReady = true;
        this.hasFetched = true;
        this.signal('ready', true);
    }

    /**
     * Updates the payload of the resource.
     * @param {ResourcePayloadType} payload
     * @returns {Promise<ResourcePayloadType>}
     */
    update(payload) {
        this._payload = Object.assign(this._payload, payload);
        return this._initializePayload(this._payload);
    }

    /**
     * Polling.
     */

    /**
     * Polls the resource.
     * @param {(payload: ResourcePayloadType) => void} onComplete
     * @param {(payload: ResourcePayloadType) => boolean} mustStopPollingCb
     * @param {number} interval
     */
    poll(onComplete, mustStopPollingCb, interval = 5000) {
        if (interval < 2000) {
            interval = 2000;
        }
        return new Promise((_resolve_, reject) => {
            if (!this.pollTimeout) {
                this._onPollCompleted = onComplete;
                this._mustStopPollingCb = mustStopPollingCb;
                this.pollCount = 0;
                return this._poll();
            } else {
                return reject();
            }
        });
    }

    stopPolling() {
        this.pollTimeout = undefined;
        clearTimeout(this.pollTimeout);
    }

    _poll() {
        return this.fetch().finally(() => this._onPollComplete());
    }

    _onPollComplete() {
        if (this._mustStopPolling()) {
            this.stopPolling();
            if (this._onPollCompleted) {
                this._onPollCompleted(this._payload);
            }
        } else {
            this.pollTimeout = setTimeout(() => this._poll(), this._config.pollInterval);
        }
    }

    _mustStopPolling() {
        return (
            (this._mustStopPollingCb && this._mustStopPollingCb(this._payload)) ||
            this.pollCount > this._config.maxPollCount
        );
    }

    async onLoad() {
        if (this.hasFetched || !this.promise || this._items?.length) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            const kill = this.on('ready', () => {
                resolve();
                kill();
            });
        });
    }

    destroy() {
        this._payload = {};
        this._unsubscribes.forEach(unsubscribe => unsubscribe());
    }
}

export default Resource;
