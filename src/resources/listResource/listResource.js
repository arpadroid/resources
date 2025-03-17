/**
 * @typedef {import('@arpadroid/services').Router} Router
 * @typedef {import('./listFilter.types').ListFilterConfigType} ListFilterConfigType
 * @typedef {import('./listResource.types').ListResourceConfigType} ListResourceConfigType
 * @typedef {import('./listResource.types').ListResourceItemType} ListResourceItemType
 * @typedef {import('./listResource.types').ListResourceItemNodeType} ListResourceItemNodeType
 */
import {
    editURL,
    sortObjectArrayByKey,
    searchObjectArray,
    paginateArray,
    getObjectId
} from '@arpadroid/tools';
import Resource, { removeResource } from '../resource/resource.js';
import ListFilter from './listFilter.js';

import { getService } from '@arpadroid/context';
/**
 * @class
 * @property {ListResourceConfigType} _config - The list resource configuration.
 */
class ListResource extends Resource {
    //////////////////////////////
    // #region INITIALIZATION
    //////////////////////////////
    /** @type {ListResourceConfigType} */
    _config = this._config;
    /**
     * Creates a new ListResource instance.
     * @param {ListResourceConfigType} config
     */
    constructor(config = {}) {
        super('', config);
    }

    _initializeProperties() {
        // /** @type {ListResourceConfigType | Record<string, never>} */
        // this._config = {};
        /** @type {Record<string, ListFilter>} */
        this.filters = {};
        /** @type {ListResourceItemType[]} */
        this.items = [];
        /** @type {Record<string, ListResourceItemType>} */
        this.rawItemsById = {};
        /** @type {Record<string, ListResourceItemType>} */
        this.itemsById = {};
        /** @type {ListResourceItemType[]} */
        this.selectedItems = [];
        /** @type {Record<string, ListResourceItemType>} */
        this.selectedItemsById = {};
        this.hasActiveFilter = false;
        this.selectionKey = '';
        this.selectionLengthKey = '';
        this.selectionRedirectKey = '';
        super._initializeProperties();
        /** @type {Router} */ // @ts-ignore
        this.router = getService('router');
    }

    /**
     * Returns the default configuration for the list resource.
     * @returns {ListResourceConfigType}
     */
    getDefaultConfig() {
        return {
            currentPage: 1,
            hasSelection: false,
            hasSelectionSave: false,
            hasToggleSave: false,
            isCollapsed: false,
            isCollapsible: false,
            isStatic: undefined,
            itemsPerPage: 0,
            listComponent: undefined,
            pageParam: 'page',
            itemIdMap: 'id',
            perPageParam: 'perPage',
            preProcessItem: undefined,
            preProcessNode: undefined,
            searchFields: ['title'],
            searchParam: 'search',
            sortByParam: 'sortBy',
            sortDirParam: 'sortDir',
            totalItems: 0,
            totalPages: 0
        };
    }

    // #endregion

    ///////////////////////////////
    // #region Get
    ///////////////////////////////

    /**
     * Returns the list component.
     * @returns {HTMLElement | undefined}
     */
    getComponent() {
        return this._config?.listComponent;
    }

    /**
     * Returns the current item index range.
     * @returns {number[]}
     */
    getItemRange() {
        const currentPage = this.getPage();
        const itemsPerPage = this.getPerPage();
        let start = (currentPage - 1) * itemsPerPage + 1;
        if (start < 0) {
            start = 0;
        }
        const totalItems = this.getTotalItems();
        let end = start + itemsPerPage - 1;
        if (end > totalItems) {
            end = totalItems;
            start = end - itemsPerPage + 1;
        }
        if (start <= 0) {
            start = 1;
        }
        return [start, end];
    }

    /**
     * Returns the number of items per page.
     * @returns {number}
     */
    getPerPage() {
        return Number(
            this?.perPageFilter?.getValue() ?? this._config?.itemsPerPage ?? this._payload?.perPage
        );
    }

    /**
     * Returns the current page.
     * @param {Record<string, any>} payload
     * @returns {number}
     */
    getPage(payload = this._payload) {
        return payload?.page ?? this.getCurrentPage();
    }

    getCurrentPage() {
        return Number(this.pageFilter?.getValue() ?? this._config?.currentPage);
    }

    /**
     * Returns the total number of pages.
     * @param {Record<string, any>} payload
     * @returns {number}
     */
    getTotalPages(payload = this._payload) {
        if (this.isStatic()) {
            const query = this.searchFilter?.getValue();
            const length = Number((query && this.staticQueryCount) || this.items?.length);
            return Math.ceil(length / this.getPerPage());
        }
        return payload?.totalPages ?? this._config?.totalPages;
    }

    getSortDirection() {
        return this?.sortDirFilter?.getValue() ?? this._payload?.defaultSorting?.order;
    }

    /**
     * Returns the filter's payload.
     * @param {string} filterId
     * @returns {Record<string, any>}
     */
    getFilterPayload(filterId) {
        return this?._payload?.filters[filterId];
    }

    // #endregion Get

    ///////////////////////////////
    // #region Is
    ///////////////////////////////

    isStatic() {
        return this._config && (this._config?.isStatic ?? !this._config.url);
    }

    isCollapsed() {
        return this._config?.isCollapsed;
    }

    /**
     * Returns whether the filter is active.
     * @param {string} filterId
     * @returns {boolean}
     */
    isFilterActive(filterId) {
        const payload = this.getFilterPayload(filterId);
        return payload?.isActive ?? this.getFilter(filterId)?.isActive();
    }

    // #endregion Is

    ///////////////////////////////
    // #region Has
    ///////////////////////////////

    hasToggleSave() {
        return this._config?.hasToggleSave;
    }

    hasSelectionSave() {
        return this._config?.hasSelectionSave;
    }

    hasSelection() {
        return Boolean(this._config?.hasSelection);
    }

    hasResults() {
        /**
         * Finds the item with the code 'no-results'.
         * @param {ListResourceItemType} item
         * @returns {boolean}
         */
        const findItem = item => item.code === 'no-results';
        return this._payload.output?.find(findItem) == undefined;
    }

    // #endregion Has

    ///////////////////////////////
    // #region Set
    ///////////////////////////////

    /**
     * Sets the current page.
     * @param {number} page
     * @returns {this}
     */
    setCurrentPage(page) {
        this.pageFilter?.setValue(page);
        this._config && (this._config.currentPage = page);
        return this;
    }

    /**
     * Sets a callback to process the HTML node once it's created.
     * @param {(node: ListResourceItemNodeType) => ListResourceItemNodeType | undefined} callback
     * @returns {this}
     */
    setPreProcessNode(callback) {
        this._config && (this._config.preProcessNode = callback);
        return this;
    }

    // #endregion Set

    /**
     * Sets an item map function to process the item's payload.
     * @param {(itemPayload: ListResourceItemType) => ListResourceItemType} callback
     * @returns {this}
     */
    mapItem(callback) {
        this._config && (this._config.preProcessItem = callback);
        return this;
    }

    /**
     * Initializes the list and fetches the list items.
     */
    _initialize() {
        super._initialize();
        if (this.hasSelectionSave()) {
            this.selectionKey = `${this.id}-selected`;
            this.selectionLengthKey = `${this.id}-selected-length`;
        }
        this._setupFilters();
        this.handleRouteChange();
    }

    haveFiltersChanged() {
        this.prevFilterSignature = this.filterSignature;
        this.filterSignature = this.getFilterSignature();
        return this.prevFilterSignature !== this.filterSignature;
    }

    // #endregion

    //////////////////////////
    // #region RESOURCE API.
    //////////////////////////

    /**
     * Fetches the list items.
     * @param {...any} args
     * @returns {Promise<any> | undefined}
     */
    fetch(...args) {
        const rv = this.isStatic() ? this._fetchStatic.apply(this, args) : super.fetch(...args);
        rv && this.initializeFilters.apply(this, args);
        return rv;
    }

    /**
     * Fetches the list items statically.
     * @param {...any} _args
     * @returns {Promise<any>}
     */
    async _fetchStatic(..._args) {
        const payload = { items: this.items };
        await this._initializePayload(payload);
        return Promise.resolve(payload);
    }

    handleRouteChange() {
        const onRouteChanged = () => this.haveFiltersChanged() && this.fetch();
        this.router?.on('route_change', onRouteChanged, this._unsubscribes);
    }

    getQuery() {
        return {
            ...(this._config?.query || {}),
            ...this.getFilterQueryParams()
        };
    }

    /**
     * Runs a search query.
     * @param {string} value
     * @returns {Promise<any> | undefined}
     */
    search(value) {
        return this.fetch({ search: value });
    }

    getItems() {
        return this.items ?? [];
    }

    /**
     * Returns the items from the payload.
     * @param {Record<string, any>} payload
     * @returns {ListResourceItemType[]}
     */
    getItemsFromPayload(payload = {}) {
        if (Array.isArray(payload)) {
            return payload;
        }
        if (Array.isArray(payload?.results)) {
            return payload.results;
        }
        if (Array.isArray(payload?.items)) {
            return payload.items;
        }
        return [];
    }

    getTotalItems(payload = this._payload) {
        if (this.isStatic() && this.searchFilter?.getValue() && this.staticQueryCount) {
            return this.staticQueryCount;
        }
        return payload?.resultCount ?? this.items?.length ?? 0;
    }

    /**
     * Initializes the payload.
     * @param {Record<string, any>} payload
     * @param {Partial<import('@arpadroid/services').HeadersType>} [headers]
     * @param {boolean} update
     * @returns {Promise<Record<string, any>>}
     */
    async _initializePayload(payload = {}, headers, update = true) {
        payload = await super._initializePayload(payload, headers);
        const items = this.getItemsFromPayload(payload);
        this.items = this.preProcessItems(items);
        payload.items = this.items;
        if (this._config) {
            this._config.totalItems = this.getTotalItems(payload);
            this._config.totalPages = this.getTotalPages(payload);
            this._config.perPage = this.getPerPage();
            if (this.pageFilter) {
                this._config.currentPage = Number(this.pageFilter.getValue()) || 1;
            }
            this.perPageFilter && (this._config.perPage = Number(this.perPageFilter.getValue()));
        }

        this.initializeSelectedItems();
        if (update) {
            const signalItems = () => {
                const items = this._getItems();
                this.signal('items', items);
                this.signal('items_updated', items);
            };
            this.isStatic() ? setTimeout(signalItems, 10) : signalItems();
        }
        return payload;
    }

    // #endregion

    //////////////////////////
    // #region Static API
    //////////////////////////

    /**
     * Paginates and sorts items from a list statically, when storage is in memory.
     * @returns {ListResourceItemType[] | undefined}
     */
    _getItems() {
        if (!this.isStatic()) return this.items;
        this._payload.output = [];
        const searchFields = this._config?.searchFields;
        const query = /** @type {string}*/ (this.searchFilter?.getValue() || '');
        /** @type {ListResourceItemType[] | any} */
        let items = searchObjectArray(this.items, query, searchFields);
        if (query?.length && !items.length) {
            this._payload.output.push({ code: 'no-results' });
            items = this.items;
        }
        this.staticQueryCount = items.length;
        const sortBy = this.sortFilter?.getValue();
        items = sortObjectArrayByKey(items, String(sortBy), String(this.sortDirFilter?.getValue()));
        items = paginateArray(items, this.getPerPage(), this.getCurrentPage());
        this.staticItems = items;
        return items;
    }

    ////////////////////////////////
    // #endregion Static API
    ////////////////////////////////

    // #region LIST API

    openList() {
        if (!this.items) {
            this.fetch();
        }
    }

    refresh(refreshFilters = true) {
        if (refreshFilters) {
            const filtersURL = this.getFiltersURL(false);
            this.router?.go(filtersURL);
        }
        return this.fetch() ?? this.request;
    }

    hasNoItems() {
        return Boolean(this.isReady && !this._getItems()?.length);
    }

    hasItems() {
        return Boolean(this.isReady && this._getItems()?.length);
    }

    /**
     * Toggles the list.
     * @param {boolean} [state]
     * @returns {this}
     */
    toggleList(state) {
        this._config &&
            (this._config.isCollapsed = typeof state !== 'undefined' ? state : !this.isCollapsed());
        if (this.hasToggleSave()) {
            this.toggleListFilter?.setValue(!this.isCollapsed());
        }
        this.signal('TOGGLE', this.isCollapsed());
        return this;
    }

    // #endregion

    // #region ITEM API

    /**
     * Sets the items.
     * @param {ListResourceItemType[]} items
     */
    setItems(items) {
        this.items = items.map(item => this.preProcessItem(item));
        const _items = this._getItems();
        this.signal('items', _items);
        this.signal('items_updated', _items);
        this.isStatic() && this.fetch();
    }

    /**
     * Adds an item to the list.
     * @param {ListResourceItemType} item
     * @param {boolean} sendUpdate
     * @param {boolean} unshift
     * @returns {ListResourceItemType}
     */
    addItem(item = {}, sendUpdate = true, unshift = false) {
        this.removeItem(item, false);
        this.preProcessItem(item);
        if (unshift) {
            this.items?.unshift(item);
        } else {
            this.items?.push(item);
        }
        this._config?.totalItems && this._config.totalItems++;
        if (sendUpdate) {
            this.signal('add_item', item, unshift);
            this.signal('items_updated', this._getItems());
        }
        return item;
    }

    /**
     * Registers an item with a node.
     * @param {ListResourceItemType} payload
     * @param {ListResourceItemNodeType} node
     * @returns {ListResourceItemType}
     */
    registerItem(payload, node) {
        if (!this.items) this.items = [];
        const _item = this.items?.find(item => item.node === node);
        if (_item) return _item;

        const { preProcessNode } = this._config ?? {};
        typeof preProcessNode === 'function' && preProcessNode(node);
        const id = String(payload.id || this.getItemId(payload));

        if (!this.itemsById?.[id]) {
            const item = this.addItem(payload, false);
            item.node = node;
            this.itemsById && (this.itemsById[id] = item);
            payload.id = id;
            return item;
        }

        this.itemsById[id].node = node;

        return this.itemsById[id];
    }

    /**
     * Adds multiple items to the list.
     * @param {ListResourceItemType[]} items
     * @param {boolean} sendUpdate
     * @param {boolean} unshift
     */
    addItems(items, sendUpdate = true, unshift = false) {
        items.map(item => this.addItem(item, false, unshift));
        if (sendUpdate) {
            this.signal('add_items', items);
            this.signal('items_updated', this._getItems());
        }
    }

    /**
     * Returns an item by its ID.
     * @param {string} id
     * @returns {ListResourceItemType | undefined}
     */
    getItem(id) {
        return this.itemsById?.[id];
    }

    /**
     * Returns the raw stateless item given an id.
     * @param {string} id
     * @returns {ListResourceItemType | undefined}
     */
    getRawItem(id) {
        return this.rawItemsById?.[id];
    }

    /**
     * Returns the item ID.
     * @param {ListResourceItemType} item
     * @returns {string | symbol | {}}
     */
    getItemId(item = {}) {
        const { mapItemId } = this._config ?? {};
        return (
            mapItemId?.(item) ||
            item[this.getIdMap()] ||
            item.id ||
            'item-' + getObjectId(item) ||
            Math.random()
        );
    }

    getIdMap() {
        return this._config?.itemIdMap || 'id';
    }

    /**
     * Returns the previous item.
     * @param {ListResourceItemType} item
     * @returns {ListResourceItemType | undefined}
     */
    getNextItem(item = {}) {
        return this.items?.[this.getItemIndex(item) + 1] ?? this.items?.[0];
    }

    /**
     * Returns the previous item.
     * @param {ListResourceItemType} item
     * @returns {ListResourceItemType | undefined}
     */
    getPreviousItem(item = {}) {
        return this.items?.[this.getItemIndex(item) - 1] ?? this.items?.[this.items.length - 1];
    }

    /**
     * Removes an item from the list.
     * @param {ListResourceItemType} item
     * @param {boolean} sendUpdate
     */
    removeItem(item = {}, sendUpdate = true) {
        const index = this.getItemIndex(item);
        if (index === -1) {
            return;
        }
        this.items?.splice(index, 1);
        if (this.itemsById?.[this.getIdMap()]) {
            delete this.itemsById?.[this.getIdMap()];
            this._config?.totalItems && this._config.totalItems--;
        }
        if (sendUpdate) {
            this.signal('remove_item', item, index);
            this.signal('items_updated', this._getItems());
        }
    }

    removeItems(sendUpdate = true) {
        this.items = [];
        this.itemsById = {};
        this._config && (this._config.totalItems = 0);
        if (sendUpdate) {
            this.signal('remove_items');
            this.signal('items_updated', this._getItems());
        }
    }

    /**
     * Updates an item.
     * @param {ListResourceItemType} item
     * @param {boolean} sendUpdate
     */
    updateItem(item = {}, sendUpdate = true) {
        const index = this.getItemIndex(item);
        if (index === -1) return;
        const itemId = item[this.getIdMap()] || this.getItemId(item) || '';
        if (this.itemsById && (typeof itemId === 'string' || typeof itemId === 'number')) {
            this.itemsById[itemId] = Object.assign(this.itemsById[itemId], item);
            sendUpdate && this.signal('update_item', this.itemsById[itemId], index);
        }
    }

    /**
     * Returns the index of an item.
     * @param {ListResourceItemType} item
     * @returns {number}
     */
    getItemIndex(item) {
        if (!this.items || typeof item[this.getIdMap()] === 'undefined') return -1;
        return this.items?.findIndex($item => {
            return $item[this.getIdMap()] === item[this.getIdMap()];
        });
    }

    /**
     * Processes the items before they're added to the list.
     * @param {ListResourceItemType[]} items
     * @returns {ListResourceItemType[]}
     */
    preProcessItems(items = []) {
        return items.map(item => this.preProcessItem(item));
    }

    /**
     * Processes an item before it's added to the list.
     * @param {ListResourceItemType} item
     * @returns {ListResourceItemType}
     */
    preProcessItem(item = {}) {
        const rawItem = item;
        const { preProcessItem } = this._config ?? {};
        if (typeof preProcessItem === 'function') {
            item = preProcessItem(item);
        }
        const id = String(this.getItemId(item));
        item.id = id;
        item.listResource = this;
        item.list = this.getComponent();
        item[this.getIdMap()] = id;
        const itemId = item?.[this.getIdMap()];
        if (typeof itemId === 'string' || typeof itemId === 'number') {
            this.itemsById && (this.itemsById[itemId] = item);
        }
        this.rawItemsById && (this.rawItemsById[id] = rawItem);
        return item;
    }

    // #endregion

    // #region FILTERS API.

    _setupFilters() {
        this.paginate();
        if (this.hasToggleSave()) {
            this.toggleListFilter = this.addFilter(`${this.id}-toggleList`, {
                defaultValue: 'false',
                hasLocalStorage: true
            });
            this._config && (this._config.isCollapsed = this.toggleListFilter.getValue() === 'false');
        }
    }

    /**
     * Returns the URL to apply the filters.
     * @param {boolean} encode
     * @returns {string}
     */
    getFiltersURL(encode = true) {
        /** @type {Record<string, any>} */
        const filters = {};
        Object.keys(this.filters || {}).map(filterKey => {
            const filter = this.filters?.[filterKey];
            if (filter?.isURLFilter()) {
                filters[filter.getUrlName()] =
                    filter.value !== filter.getDefaultValue() ||
                    filter.hasLocalStorage() ||
                    !filter.allowClear()
                        ? filter.value
                        : null;
            }
        });
        return editURL(window.location.href.replace(window.location.origin, ''), filters, encode);
    }

    /**
     * Returns the URL to clear the filters.
     * @returns {string}
     */
    getClearFiltersURL() {
        /** @type {Record<string, any>} */
        const filters = {};
        this.filters &&
            Object.keys(this.filters).map(filterKey => {
                const filter = this.filters?.[filterKey];
                if (filter?.isURLFilter()) {
                    filters[filter.getUrlName()] = null;
                }
            });
        if (this.searchFilter) {
            filters[this.searchFilter.getUrlName()] = undefined;
        }
        return editURL(window.location.href.replace(window.location.origin, ''), filters);
    }

    /**
     * Returns the filter query parameters.
     * @returns {Record<string, any>}
     */
    getFilterQueryParams() {
        /** @type {Record<string, any>} */
        const query = {};
        this.getFilters()?.map(filter => {
            if (!filter.isRequestFilter()) {
                return;
            }
            const value = filter.getValue();
            query[filter.getQueryName() || filter.getAlias() || filter.getId()] = value;
        });
        return query;
    }

    /**
     * Initializes the filters.
     * @param {...any} _args
     */
    initializeFilters(..._args) {
        this.hasActiveFilter = false;
        /** @type {ListFilter[]} */
        this.activeFilters = [];
        this.getFilters()?.map(filter => {
            filter.initializeValue();
            const exceptions = [this.sortDirFilter, this.sortFilter];

            if (!exceptions.includes(filter) && filter.isActive()) {
                this.activeFilters?.push(filter);
                this.hasActiveFilter = true;
            }
        });
    }

    /**
     * Adds a sort filter.
     * @param {string} sortBy
     * @param {ListFilterConfigType} config
     * @returns {ListFilter}
     */
    addSortFilter(sortBy = this._config?.sortByParam || '', config = {}) {
        this.sortFilter = this.addFilter(sortBy, {
            defaultValue: '',
            isRequestFilter: true,
            isURLFilter: true,
            hasLocalStorage: true,
            ...config
        });
        return this.sortFilter;
    }

    getSortFilter() {
        return this.sortFilter ?? this.addSortFilter();
    }

    addSortDirFilter(paramName = this._config?.sortDirParam, config = {}) {
        paramName &&
            (this.sortDirFilter = this.addFilter(paramName, {
                isRequestFilter: true,
                isURLFilter: true,
                defaultValue: 'asc',
                ...config
            }));
        return this.sortDirFilter;
    }

    getSortDirFilter() {
        return this.sortDirFilter ?? this.addSortDirFilter();
    }

    /**
     * Sets the sort filter.
     * @param {string} sortBy
     * @param {string} sortDir
     * @returns {this}
     */
    setSort(sortBy, sortDir) {
        this.sortFilter?.setValue(sortBy);
        this.sortDirFilter?.setValue(sortDir);
        return this;
    }

    addViewFilter(config = {}) {
        this.viewFilter = this.addFilter(`${this.id}-view`, {
            defaultValue: 'list',
            alias: 'views',
            hasLocalStorage: true,
            ...config
        });
        return this.viewFilter;
    }

    /**
     * Returns the view filter.
     * @param {ListFilterConfigType} config
     * @returns {ListFilter}
     */
    getViewFilter(config) {
        return this.viewFilter ?? this.addViewFilter(config);
    }

    /**
     * Adds a search filter.
     * @param {string} searchParam
     * @returns {ListFilter}
     */
    addSearchFilter(searchParam = this._config?.searchParam || '') {
        if (this.searchFilter) return this.searchFilter;
        this.searchFilter = this.addFilter(searchParam, {
            defaultValue: '',
            isRequestFilter: true,
            isURLFilter: true
        });
        return this.searchFilter;
    }

    getSearchFilter() {
        return this.searchFilter ?? this.addSearchFilter();
    }

    hasURLFilter() {
        if (!this.filters) return false;
        for (const [, filter] of Object.entries(this.filters)) {
            if (filter.isURLFilter()) {
                return true;
            }
        }
        return false;
    }

    canClearFilters() {
        if (!this.filters) return false;
        for (const [, filter] of Object.entries(this.filters)) {
            if (this.canClearFilter(filter)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns whether the filter can be cleared.
     * @param {ListFilter} filter
     * @returns {boolean}
     */
    canClearFilter(filter) {
        return Boolean(
            filter.allowClear() && filter.isRequestFilter() && filter.getDefaultValue() !== filter.getValue()
        );
    }

    /**
     * Adds a filter.
     * @param {string} id - The filter ID blaasidahd asdh.
     * @param {ListFilterConfigType} options
     * @returns {ListFilter}
     */
    addFilter(id, options) {
        const filter = new ListFilter(id, options);
        if (!this.filters) this.filters = {};
        typeof filter.key === 'string' && (this.filters[filter.key] = filter);
        return filter;
    }

    /**
     * Sets a filter value.
     * @param {string} name
     * @param {any} value
     * @returns {this}
     */
    setFilter(name, value = undefined) {
        const filter = this.filters?.[name];
        filter?.setValue(value);
        return this;
    }

    /**
     * Removes a filter.
     * @param {string} name
     */
    removeFilter(name) {
        let id = name;
        if (typeof this.filters?.[name] !== 'undefined') {
            id = this.filters[name].getId();
            delete this.filters[name];
        }
        localStorage.removeItem(id);
    }

    /**
     * Returns a filter by its name.
     * @param {string} name
     * @returns {ListFilter | undefined}
     */
    getFilter(name) {
        return this.filters?.[name];
    }

    getFilters() {
        return this.filters && Object.values(this.filters);
    }

    getFilterValues() {
        /** @type {Record<string, any>} */
        const values = {};
        this.getFilters()?.map(filter => {
            const filterKey = filter?.getAlias() || filter?.getId();
            values[filterKey] = filter.getValue();
        });
        return values;
    }

    getFilterSignature() {
        return JSON.stringify(this.getFilterValues());
    }

    /**
     * Paginates the list.
     * @param {number} itemsPerPage
     * @returns {this}
     */
    paginate(itemsPerPage = this.getPerPage()) {
        this.pageFilter = this.addFilter(this.id + '-page', {
            defaultValue: 1,
            isURLFilter: true,
            isRequestFilter: true,
            urlParamName: this._config?.pageParam,
            alias: this._config?.pageParam ?? 'page',
            allowClear: false,
            preProcessQueryParam: value => (Number(value) || 1) - 1,
            callback: page => this._config && (this._config.currentPage = Number(page))
        });
        this.perPageFilter = this.addFilter(this.id + '-size', {
            defaultValue: itemsPerPage,
            hasLocalStorage: false,
            alias: this._config?.perPageParam ?? 'size',
            urlParamName: this._config?.perPageParam,
            queryName: this._config?.perPageParam,
            isURLFilter: true,
            isRequestFilter: true,
            allowClear: false
        });
        return this;
    }

    /**
     * Goes to a specified page.
     * @param {number} page
     * @returns {Promise<Record<string, any>> | undefined}
     */
    goToPage(page) {
        const url = editURL(window.location.href, { [String(this._config?.pageParam)]: page });
        const rv = this.router?.go(url);
        this.pageFilter?.setValue(page);
        return rv;
    }

    nextPage() {
        const page = this.getNextPage();
        return this.goToPage(page);
    }

    previousPage() {
        const page = this.getPreviousPage();
        return this.goToPage(page);
    }

    getNextPage() {
        const currentPage = this.getCurrentPage();
        const totalPages = this.getTotalPages();
        let page = currentPage + 1;
        page > totalPages && (page = 1);
        return page;
    }

    getPreviousPage() {
        let page = this.getCurrentPage() - 1;
        page < 1 && (page = this.getTotalPages());
        this.pageFilter?.setValue(page);
        return page;
    }

    clearFilters(sendUpdate = false) {
        this.clearFilterValues(true);
        this.hasActiveFilter = false;
        this.pageFilter?.resetValue(sendUpdate);
        const url = this.getClearFiltersURL();
        this.router?.go(url);
    }

    clearFilterValues(sendUpdate = false) {
        this.filters &&
            Object.keys(this.filters).map(filterKey => {
                const filter = this.filters?.[filterKey];
                filter?.allowClear() && filter?.resetValue(sendUpdate);
            });
    }

    // #endregion

    // #region SELECTION API.

    initializeSelectedItems() {
        this.selectedItems = this.getSelectedItems();
        this.selectedItemsById = {};
        this.selectedItems?.map(item => {
            return this.selectedItemsById?.[String(this.getItemId(item))] || item;
        });
        return this;
    }

    hasSelections() {
        return Boolean(this.selectedItems?.length);
    }

    /**
     * Returns whether an item is selectable.
     * @param {ListResourceItemType} _item
     * @returns {boolean}
     */
    isItemSelectable(_item) {
        return this.hasSelection();
    }

    hasSelectableItems() {
        if (!this.items) return false;
        for (const item of this.items) {
            if (this.isItemSelectable(item)) {
                return true;
            }
        }
        return false;
    }

    getSelectableItems() {
        return this.items?.filter(item => this.isItemSelectable(item));
    }

    getSelectedItems() {
        return this.hasSelectionSave() ? this.getSavedSelections() : this.selectedItems ?? [];
    }

    getSavedSelections() {
        if (!this.selectionKey) return [];
        const selectionData = localStorage.getItem(this.selectionKey);
        return selectionData ? JSON.parse(selectionData) : [];
    }

    /**
     * Sets the selected items.
     * @param {ListResourceItemType[]} items
     */
    setSelectedItems(items = []) {
        this.selectedItems = items;
        if (this.hasSelectionSave()) {
            this.selectionKey && localStorage.setItem(this.selectionKey, JSON.stringify(items));
            this.selectionLengthKey &&
                localStorage.setItem(this.selectionLengthKey, items?.length.toString());
        }
    }

    getSelectedIds() {
        const items = this.getSelectedItems();
        /** @type {string[]} */
        const rv = [];

        /**
         * Maps the item to its ID.
         * @param {ListResourceItemType} item
         */
        const mapItem = item => {
            /** @type {string} */
            const id = String(item[this.getIdMap()]);
            typeof item[id] === 'string' && rv.push(id);
        };
        items.map(mapItem);
        return rv;
    }

    getSelectedCount() {
        if (this.hasSelectionSave() && this.selectionLengthKey) {
            return parseInt(localStorage.getItem(this.selectionLengthKey) ?? '0', 10);
        }
        return this.selectedItems?.length;
    }

    hasPartialSelection() {
        if (!this.items) return false;
        for (const item of this.items) {
            if (this.isItemSelectable(item) && !this.isSelected(item)) {
                return true;
            }
        }
        return false;
    }

    preProcessSelectionItem(item = {}) {
        return item;
    }

    isSelected(item = {}) {
        const itemID = String(this.getItemId(item));
        return Boolean(itemID && this.selectedItemsById?.[itemID]);
    }

    /**
     * Selects an item.
     * @param {ListResourceItemType} item
     * @param {ListResourceItemType[]} [items]
     * @param {boolean} callOnChange
     * @returns {this}
     */
    selectItem(item = {}, items, callOnChange = true) {
        if (this.isSelected(item) || (this.hasSelection() && !this.isItemSelectable(item))) {
            return this;
        }
        item = this.preProcessSelectionItem(item);
        items = items || this.getSelectedItems();
        items?.push(item);
        this.setSelectedItems(items);
        const itemID = String(this.getItemId(item));
        this.selectedItemsById && (this.selectedItemsById[itemID] = item);
        if (typeof itemID === 'string' || typeof itemID === 'number') {
            this.signal(`item_selected_${itemID}`, true);
        }
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems);
        }
        return this;
    }

    deselectItem(item = {}, callOnChange = true) {
        if (!this.isSelected(item)) {
            return;
        }
        const itemID = String(this.getItemId(item));
        delete this.selectedItemsById?.[itemID];
        this.selectedItemsById && this.setSelectedItems(Object.values(this.selectedItemsById));
        this.signal(`item_deselected_${itemID}`, false);
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems?.length);
        }
        return this;
    }

    toggleItem(item = {}, callOnChange = true) {
        if (!this.isSelected(item)) {
            this.selectItem(item, undefined, false);
        } else {
            this.deselectItem(item, false);
        }
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems?.length);
        }
        return this;
    }

    /**
     * Changes the state of all selections.
     * @param {boolean} selected
     * @param {boolean} callOnChange
     * @param {ListResourceItemType[]} items
     * @returns {this}
     */
    setSelections(selected, callOnChange = true, items = this._getItems() || []) {
        if (selected) {
            items.map(item => this.selectItem(item, undefined, false));
        } else {
            items.map(item => this.deselectItem(item, false));
        }
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems?.length);
        }
        return this;
    }

    /**
     * Toggles the selection of all items.
     * @returns {boolean}
     */
    toggleSelections() {
        let value = false;
        for (const item /** @type {ListResourceItemType} */ of this.items || []) {
            if (this.isItemSelectable(item) && !this.isSelected(item)) {
                value = true;
                break;
            }
        }
        this.setSelections(value);
        return value;
    }

    /**
     * Adds selections to the list.
     * @param {ListResourceItemType[]} items
     * @param {boolean} callOnChange
     * @returns {this}
     */
    addSelections(items, callOnChange = true) {
        const $items = this.getSelectedItems();
        items.map(item => this.selectItem(item, $items, false));
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems);
        }
        return this;
    }

    clearSelectionData() {
        if (this.hasSelectionSave()) {
            this.selectionKey && localStorage.removeItem(this.selectionKey);
            this.selectionLengthKey && localStorage.removeItem(this.selectionLengthKey);
            this.selectionRedirectKey && localStorage.removeItem(this.selectionRedirectKey);
        }
        this.selectedItems?.forEach(item => this.signal(`item_deselected_${String(item.id)}`));
        this.selectedItems = [];
        this.selectedItemsById = {};
        this.signal('selection_change', this.selectedItems.length);
        return this;
    }

    filterBySelections() {
        const selected = this.getSelectedItems();
        const payload = {
            results: selected,
            resultCount: selected.length,
            totalPages: 1,
            currentPage: 1
        };
        this._initializePayload(payload, undefined, false);
        this.update(payload);
    }

    destroy() {
        this.items = [];
        this.itemsById = {};
        this.rawItemsById = {};
        this.selectedItems = [];
        this.selectedItemsById = {};
        this.filters = {};
        this._payload = {};
        removeResource(this.id);
        this.clearSelectionData();
        super.destroy();
    }

    async onLoad() {
        return this.items?.length ? Promise.resolve() : super.onLoad();
    }

    // #endregion
}

export default ListResource;
