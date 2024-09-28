/**
 * @typedef {import("./listFilterInterface").ListFilterInterface} ListFilterInterface
 */

import { ObserverTool, mergeObjects, arrayEmpty, getURLParam } from '@arpadroid/tools';
import { Context } from '@arpadroid/application';

class ListFilter {
    /** @type {(property: string, value: unknown) => void} signal */
    signal;
    /** @type {(property: string, callback: () => void) => () => void} on */
    on;

    _options = [];

    /**
     * The list filter constructor is awesome.
     * @param {string} id
     * @param {ListFilterInterface} config
     */
    constructor(id, config) {
        ObserverTool.mixin(this);
        this._id = id;
        this.setConfig(config);
        this._initializeProperties(id);
    }

    _initializeProperties() {
        this.key = this._config.alias || this._id;
        this._isActive = false;
    }

    setConfig(config = {}) {
        /** @type {ListFilterInterface} */
        this._config = mergeObjects(this.getDefaultConfig(), config);
        return this;
    }

    /**
     * Returns the default config for the list filter.
     * @returns {ListFilterInterface}
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

    setDefaultValue(value) {
        this._config.defaultValue = value;
        return this;
    }

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
            this.signal('value', value, this);
        }
        this.value = value;
        this.setIsActive();
        return this;
    }

    setIsActive() {
        const { allowClear, defaultValue, isRequestFilter } = this._config;
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
        const isPopState = Context.Router?.isPopState();
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
        return this._isActive;
    }

    /**
     * Gets the local storage value for the list filter.
     * @returns {string | undefined}
     */
    getSavedValue() {
        if (this._config.hasLocalStorage) {
            try {
                return JSON?.parse(localStorage.getItem(this._id));
            } catch (error) {
                console.error(error);
            }
        }
    }

    /**
     * Gets the URL value for the list filter.
     * @returns {string}
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
     * @param {ListFilterInterface} options
     */
    setOptions(options) {
        this._options = options;
    }

    getOptions() {
        return this._options;
    }
}
export default ListFilter;
