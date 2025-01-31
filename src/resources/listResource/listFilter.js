/**
 * @typedef {import("./listFilter.types").ListFilterConfigType} ListFilterConfigType
 * @typedef {import("./listFilter.types").ListFilterOptionType} ListFilterOptionType
 * @typedef {import("./listFilter.types").ListFilterOptionsType} ListFilterOptionsType
 */
import { getService } from '@arpadroid/context';
import { observerMixin, mergeObjects, arrayEmpty, getURLParam } from '@arpadroid/tools';
import { dummySignal, dummyListener } from '@arpadroid/tools';

class ListFilter {
    /** @type {ListFilterOptionsType}  */
    _options = [];
    /** @type {ListFilterConfigType} */
    _config = {};

    /**
     * The list filter constructor is awesome.
     * @param {string} id
     * @param {ListFilterConfigType} config
     */
    constructor(id, config) {
        this.signal = dummySignal;
        this.on = dummyListener;
        observerMixin(this);
        this._id = id;
        this.setConfig(config);
        this._initializeProperties();
    }

    /**
     * Sets the configuration for the list filter.
     * @param {ListFilterConfigType} config
     * @returns {ListFilter}
     */
    setConfig(config = {}) {
        /** @type {ListFilterConfigType} */
        this._config = mergeObjects(this.getDefaultConfig(), config);
        return this;
    }

    _initializeProperties() {
        this.key = this._config?.alias || this._id;
        this._isActive = false;
    }

    /**
     * Returns the default config for the list filter.
     * @returns {ListFilterConfigType}
     */
    getDefaultConfig() {
        return {
            urlParamName: this._id,
            isURLFilter: false,
            isOnlyURLFilter: false,
            isRequestFilter: false,
            hasLocalStorage: false,
            allowClear: true
        };
    }

    /**
     * Sets the default value for the list filter.
     * @param {unknown} value
     * @returns {ListFilter}
     */
    setDefaultValue(value) {
        this._config.defaultValue = value;
        return this;
    }

    /**
     * Sets the URL parameter name for the list filter.
     * @param {boolean} isUrlFilter
     * @returns {ListFilter}
     */
    setURLFilter(isUrlFilter) {
        this._config.isURLFilter = isUrlFilter;
        return this;
    }

    initializeValue() {
        const currentValue = this.value;
        this.value = this.getValue();
        this.setIsActive();
        if (currentValue !== this.value) {
            this.setValue(this.value, false);
            this.signal('value', this.value, this);
        }
    }

    /**
     * Sets the value for the list filter.
     * @param {unknown} value
     * @param {boolean} callSubscribers
     * @returns {ListFilter}
     */
    setValue(value, callSubscribers = true) {
        const { callback, hasLocalStorage, preProcessValue } = this._config;
        if (typeof preProcessValue === 'function') {
            value = preProcessValue(value, this);
        }

        const newValue = value;
        const currentValue = this.getValue();
        if (hasLocalStorage) {
            if (value === null) {
                localStorage.removeItem(this._id);
            } else {
                localStorage.setItem(this._id, JSON.stringify(value));
            }
        }
        if (newValue !== currentValue && callSubscribers) {
            if (typeof callback === 'function') {
                callback(value);
            }
            /** @todo Check why the filter is receiving double signal. */
            this.signal('value', value, this);
        }
        this.value = value;
        this.setIsActive();
        return this;
    }

    setIsActive() {
        const { allowClear, defaultValue, isRequestFilter } = this._config;
        // @ts-ignore
        const areEmptyArrays = arrayEmpty(this.value) && arrayEmpty(defaultValue);
        if (
            typeof this.value === 'undefined' ||
            this.value === null ||
            this.value === defaultValue ||
            areEmptyArrays
        ) {
            this._isActive = false;
        } else if (allowClear && isRequestFilter) {
            this._isActive = true;
        }
    }

    /**
     * Gets the value for the list filter.
     * @returns {unknown}
     */
    getValue() {
        const { isOnlyURLFilter, defaultValue, hasLocalStorage, isURLFilter, preProcessValue } = this._config;
        let value = typeof this.value !== 'undefined' ? this.value : defaultValue;
        this.urlValue = this.getUrlValue();
        if (isOnlyURLFilter) {
            return this.urlValue;
        }
        const savedValue = this.getSavedValue();
        /**
         * @todo Implement checking is pop state without Context dependency.
         */
        const isPopState = Boolean(getService('router')?.isPopState());

        if (isURLFilter && typeof this.urlValue !== 'undefined') {
            value = this.urlValue;
        } else if (!isPopState && hasLocalStorage && typeof savedValue !== 'undefined') {
            value = savedValue;
        }
        const hasNoValue = typeof value === 'undefined' || value === null;
        if (hasNoValue || (isURLFilter && !this.urlValue && (!savedValue || isPopState))) {
            value = defaultValue;
        }
        if (typeof preProcessValue === 'function') {
            value = preProcessValue(value, this);
        }
        return value;
    }

    /**
     * If the filter is active.
     * @returns {boolean}
     */
    isActive() {
        return Boolean(this._isActive);
    }

    /**
     * Gets the local storage value for the list filter.
     * @returns {string | undefined}
     */
    getSavedValue() {
        if (this._config.hasLocalStorage) {
            try {
                const item = localStorage.getItem(this._id);
                return item ? JSON.parse(item) : undefined;
            } catch (error) {
                console.error(error);
            }
        }
    }

    /**
     * Gets the URL value for the list filter.
     * @returns {string | undefined}
     */
    getUrlValue() {
        return getURLParam(this.getUrlName(), window.location.href);
    }

    /**
     * Resets the value for the list filter to its default value or undefined.
     * @param {boolean} sendSignal
     */
    resetValue(sendSignal = true) {
        this.value = this._config.defaultValue ?? null;
        this.setValue(this.value, sendSignal);
    }

    hasChanged() {
        return this.value !== this._config.defaultValue;
    }

    preProcessItem(item = {}) {
        return item;
    }

    allowClear() {
        return this._config.allowClear;
    }

    /**
     * Sets the allow clear value for the list filter.
     * @param {boolean} allowClear
     */
    setAllowClear(allowClear) {
        this._config.allowClear = allowClear;
    }

    getDefaultValue() {
        return this._config.defaultValue;
    }

    hasLocalStorage() {
        return this._config.hasLocalStorage;
    }

    getUrlName() {
        return this._config.urlParamName ?? this._id;
    }

    isURLFilter() {
        return this._config.isURLFilter;
    }

    isRequestFilter() {
        return this._config.isRequestFilter;
    }

    getPreProcessor() {
        return this._config.preProcessor;
    }

    getAlias() {
        return this._config.alias;
    }

    getQueryName() {
        return this._config.queryName;
    }

    getId() {
        return this._id;
    }

    /**
     * Sets options for the list filter to be used by the list component.
     * @param {ListFilterOptionsType} options
     */
    setOptions(options) {
        this._options = options;
    }

    /**
     * Gets the options for the list filter.
     * @returns {ListFilterOptionsType}
     */
    getOptions() {
        return this._options;
    }
}
export default ListFilter;
