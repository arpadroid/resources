/**
 * @typedef {import('./resource.types').ResourceConfigType} ResourceConfigType
 * @typedef {import('./resource.types').ResourceResponseType} ResourceResponseType
 * @typedef {import('./resource.types').ResourcePayloadType} ResourcePayloadType
 * @typedef {import('@arpadroid/services').HeadersType} HeadersType
 * @typedef {import('@arpadroid/services').APIService} APIService
 */
import { dummyListener, dummyOff, dummySignal, mergeObjects, observerMixin } from '@arpadroid/tools';
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
    hasFailed = false;
    hasFetched = false;
    isReady = true;
    /** @type {Promise<ResourcePayloadType> | undefined} */
    promise;
    /** @type {Promise<ResourceResponseType> | undefined} */
    request;
    /** @type {Partial<HeadersType> | undefined} */
    requestHeaders;
    pollCount = 0;

    /**
     * Creates a new resource.
     * @param {string} url
     * @param {ResourceConfigType | Record<string, never>} config
     */
    constructor(url, config = {}) {
        /** @type {APIService} */ // @ts-ignore
        this.apiService = getService('apiService');
        /** @type {(() => void)[]} */
        this._unsubscribes = [];
        this.signal = dummySignal;
        this.on = dummyListener;
        this.off = dummyOff;
        observerMixin(this);
        this.id = config?.id ?? this.constructor.name;
        this._initializePayload = this._initializePayload.bind(this);
        this.setConfig(config);
        this.setUrl(url);
        this._initialize();
        resourceStore[this.id] = this;
    }

    /**
     * Sets the URL of the resource.
     * @param {string} url
     * @returns {Resource}
     */
    setUrl(url) {
        /** @type {string} */
        this._url = url;
        return this;
    }

    /**
     * Sets the payload of the resource.
     * @param {ResourcePayloadType} payload
     * @returns {Resource}
     */
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
        this._config = this._setConfig(config);
        return this;
    }

    /**
     * Merges the default configuration with the provided configuration.
     * @param {ResourceConfigType | Record<string, never>} [config]
     * @returns {ResourceConfigType | any}
     */
    _setConfig(config = {}) {
        return mergeObjects(this.getDefaultConfig(), config) || {};
    }

    /**
     * Returns the default configuration of the resource.
     * @returns {ResourceConfigType}
     */
    getDefaultConfig() {
        return {
            url: '',
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
            this._initializePayload(this._config?.payload);
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
            if (this._config?.mode === 'consecutive') {
                this.request = this.fetchConsecutive(...args);
                return this.request;
            }
            /** @type {Promise<any>[]} */
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
            .catch(error => this._onError(error));
    }

    /**
     * Fetches main resource.
     * @param {...any} args
     * @returns {Promise<ResourceResponseType | ResourcePayloadType | undefined>}
     */
    // eslint-disable-next-line no-unused-vars
    async _fetch(...args) {
        const headers = this.getHeaders();

        /**
         * OnFetchCompleted callback.
         * @param {ResourceResponseType} payload
         * @returns {Promise<ResourcePayloadType>}
         */
        const onFetchCompleted = async payload => {
            const validResponse = this.validateResourcePayload(payload);
            if (validResponse !== true) {
                return Promise.reject(validResponse);
            }
            return this._initializePayload(payload, headers);
        };
        const url = this.getURL();
        if (!url) return Promise.reject('URL is not set');
        return this.apiService // @ts-ignore
            .fetch(url, {
                query: this.getQuery(),
                headers
            })
            .then(onFetchCompleted);
    }

    /**
     * Sets the fetch function to be used by the resource.
     * @param {() => Promise<any>} fetch
     */
    setFetch(fetch) {
        this._config && (this._config.fetch = fetch);
    }

    /**
     * Validates the payload of the resource.
     * @param {ResourceResponseType} payload
     * @returns {boolean | string}
     */
    validateResourcePayload(payload) {
        console.log(
            'Override validateResourcePayload method to validate the payload of the resource.',
            payload
        );
        return true;
    }

    getURL() {
        return this._url;
    }

    /**
     * Returns the headers of the resource.
     * @returns {Partial<HeadersType> | undefined}
     */
    getHeaders() {
        return;
    }

    getQuery() {
        return this._config?.query;
    }

    fetchPromises() {
        return [];
    }

    /**
     * Initializes the payload of the resource.
     * @param {ResourcePayloadType} payload
     * @param {Partial<HeadersType> | undefined} [headers]
     * @returns {Promise<ResourcePayloadType>}
     */
    async _initializePayload(payload = {}, headers) {
        this._payload = this._getPayload(payload);
        this._payload = this._preprocessPayload(this._payload);
        /** @type {Headers | null} */
        this.requestHeaders = headers;
        this.signal('payload', this._payload);
        return this._payload;
    }

    /**
     * Returns the payload from the response.
     * @param {ResourceResponseType & ResourcePayloadType} response
     * @returns {ResourcePayloadType}
     */
    _getPayload(response) {
        return response?.value?.payload ?? response?.payload ?? response;
    }

    /**
     * Preprocesses the payload before setting it to the resource.
     * @param {ResourcePayloadType} payload
     * @returns {ResourcePayloadType}
     */
    _preprocessPayload(payload) {
        return payload;
    }

    /**
     * Returns the payload of the resource.
     * @returns {ResourcePayloadType}
     */
    getPayload() {
        return { ...this._payload };
    }

    _onSuccess() {
        this.hasFailed = false;
        return Promise.resolve(this._payload);
    }

    _onError(response = {}) {
        this.hasFailed = true;
        if (this._config?.showLogs) {
            console.error('ERROR FETCHING PAYLOAD:', this, response);
        }
        this.signal('ERROR', response);
        return Promise.reject(response);
    }

    _onComplete() {
        setTimeout(() => (this.isReady = true), this._config?.debounceFetch);
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
        if (interval < 2000) interval = 2000;
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
        return this.fetch()?.finally(() => this._onPollComplete());
    }

    _onPollComplete() {
        if (this._mustStopPolling()) {
            this.stopPolling();
            if (this._onPollCompleted) {
                this._onPollCompleted(this._payload);
            }
        } else {
            this.pollTimeout = setTimeout(() => this._poll(), this._config?.pollInterval);
        }
    }

    _mustStopPolling() {
        return (
            (this._mustStopPollingCb && this._mustStopPollingCb(this._payload)) ||
            this.pollCount > Number(this._config?.maxPollCount)
        );
    }

    async onLoad() {
        if (this.hasFetched || !this.promise) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            const kill = this.on('ready', () => {
                resolve(true);
                kill && kill();
            });
        });
    }

    destroy() {
        this._payload = {};
        this._unsubscribes.forEach(unsubscribe => unsubscribe());
    }
}

export default Resource;
