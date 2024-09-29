/**
 * @typedef {import('./listFilterInterface').ListFilterInterface} ListFilterInterface
 */
import { Context } from '@arpadroid/application';
import { editURL } from '@arpadroid/tools';
import Resource, { removeResource } from '../resource/resource.js';
import ListFilter from './listFilter.js';

class ListResource extends Resource {
    // #region INITIALIZATION
    constructor(config = {}) {
        super('', config);
    }
    _initializeProperties(config = {}) {
        super._initializeProperties(config);
        this.items = [];
        this.itemsById = {};
        this.rawItemsById = {};
        this.itemIdMap = 'id';
        this.filters = {};
        this.hasActiveFilter = false;
        this.selectedItems = [];
        this.selectedItemsById = {};
    }

    getDefaultConfig() {
        return {
            pageParam: 'page',
            searchParam: 'search',
            perPageParam: 'perPage',
            sortByParam: 'sortBy',
            sortDirParam: 'sortDir',
            currentPage: 1,
            itemsPerPage: 0,
            hasSelection: false,
            totalPages: 0,
            totalItems: 0,
            isCollapsible: false,
            isCollapsed: false,
            hasToggleSave: false,
            hasSelectionSave: false,
            preProcessItem: undefined,
            preProcessNode: undefined,
            mapItemId: undefined
        };
    }

    // #endregion

    // #region ACCESSORS

    setContext() {}

    getContext() {}

    isCollapsed() {
        return this._config.isCollapsed;
    }

    hasToggleSave() {
        return this._config.hasToggleSave;
    }

    hasSelectionSave() {
        return this._config.hasSelectionSave;
    }

    hasSelection() {
        return this._config.hasSelection;
    }

    getCurrentPage() {
        return Number(this.pageFilter?.getValue() ?? this._config.currentPage);
    }

    setCurrentPage(page) {
        this.pageFilter.setValue(page);
        this._config.currentPage = page;
        return this;
    }

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

    getPerPage() {
        return Number(this?.perPageFilter?.getValue() ?? this._config.itemsPerPage ?? this._payload?.perPage);
    }

    getPage(payload = this._payload) {
        return payload?.page ?? this.getCurrentPage();
    }

    getTotalPages(payload = this._payload) {
        return payload?.totalPages ?? this._config.totalPages;
    }

    getSortDirection() {
        return this?.sortDirFilter?.getValue() ?? this._payload?.defaultSorting?.order;
    }

    hasResults() {
        return this._payload.output?.find(item => item.code === 'no-results') == undefined;
    }

    mapItem(callback) {
        this._config.preProcessItem = callback;
        return this;
    }

    setPreProcessNode(callback) {
        this._config.preProcessNode = callback;
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
    }

    haveFiltersChanged() {
        this.prevFilterSignature = this.filterSignature;
        this.filterSignature = this.getFilterSignature();
        return this.prevFilterSignature !== this.filterSignature;
    }

    getFilterPayload(filterId) {
        return this?._payload?.filters[filterId];
    }

    isFilterActive(filterID) {
        const payload = this.getFilterPayload(filterID);
        return payload?.isActive ?? this.getFilter(filterID)?.isActive();
    }

    // #endregion

    // #region RESOURCE API.

    fetch(...args) {
        const rv = super.fetch(...args);
        this.handleRouteChange();
        if (rv) {
            this.initializeFilters(...args);
        }
        return rv;
    }

    handleRouteChange() {
        this._url &&
            this._unsubscribes.push(
                Context.Router.on('route_change', () => this.haveFiltersChanged() && this.fetch())
            );
    }

    getQuery() {
        return {
            ...this.resourceParams,
            ...this.getFilterQueryParams()
        };
    }

    setIsProcessing(value) {
        this.isProcessing = value;
        this.signal('PROCESSING', value);
        return this;
    }

    search(value) {
        return this.fetch({ search: value });
    }

    getItems() {
        return this.items ?? [];
    }

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
        return payload?.resultCount ?? this.getItems().length;
    }

    async _initializePayload(payload = {}, headers = {}, update = true) {
        payload = await super._initializePayload(payload, headers);
        const items = this.getItemsFromPayload(payload);
        this.items = this.preProcessItems(items);
        payload.items = this.items;
        this._config.totalItems = this.getTotalItems(payload);
        this._config.totalPages = this.getTotalPages(payload);
        this._config.perPage = this.getPerPage(payload);
        if (this.pageFilter) {
            this._config.currentPage = parseInt(this.pageFilter.getValue(), 10) || 1;
        }
        if (this.perPageFilter) {
            this._config.perPage = this.perPageFilter.getValue();
        }
        this.initializeSelectedItems();
        if (update) {
            this.signal('items', this.items);
            this.signal('items_updated', this.items);
        }
        return payload;
    }

    // #endregion

    // #region LIST API

    openList() {
        if (!this.items) {
            this.fetch();
        }
    }

    refresh(refreshFilters = true) {
        if (refreshFilters) {
            const filtersURL = this.getFiltersURL(false);
            Context.Router.go(filtersURL);
        }
        return this.fetch() ?? this.request;
    }

    hasNoItems() {
        return Boolean(this.isReady && !this.items.length);
    }

    hasItems() {
        return Boolean(this.isReady && this.items.length);
    }

    toggleList(state) {
        this._config.isCollapsed = typeof state !== 'undefined' ? state : !this.isCollapsed();
        if (this.hasToggleSave()) {
            this.toggleListFilter.setValue(!this.isCollapsed());
        }
        this.signal('TOGGLE', this.isCollapsed());
        return this;
    }

    // #endregion

    // #region ITEM API

    setItems(items) {
        this.items = items.map(item => this.preProcessItem(item));
        this.signal('set_items', this.items);
        this.signal('items_updated', this.items);
    }

    addItem(item = {}, sendUpdate = true, unshift = false) {
        this.removeItem(item, false);
        this.preProcessItem(item);
        if (unshift) {
            this.items.unshift(item);
        } else {
            this.items.push(item);
        }
        this._config.totalItems++;
        if (sendUpdate) {
            this.signal('add_item', item, unshift);
            this.signal('items_updated', this.items);
        }
        return item;
    }

    registerItem(payload = {}, node) {
        const { id } = payload;
        const _item = this.items.find(item => item.node === node);
        if (_item) {
            return _item;
        }
        const { preProcessNode } = this._config;
        typeof preProcessNode === 'function' && preProcessNode(node);
        if (!this.itemsById[id]) {
            const item = this.addItem(payload, false);
            item.node = node;
            this.itemsById[item.id] = item;
            payload.id = item.id;
            return item;
        }

        this.itemsById[id].node = node;
        return this.itemsById[id];
    }

    addItems(items, sendUpdate = true, unshift = false) {
        items.map(item => this.addItem(item, false, unshift));
        if (sendUpdate) {
            this.signal('add_items', items);
            this.signal('items_updated', this.items);
        }
    }

    getItem(id) {
        return this.itemsById[id];
    }

    getRawItem(id) {
        return this.rawItemsById[id];
    }

    getItemId(item = {}) {
        const { mapItemId } = this._config;
        return mapItemId?.(item) || item[this.itemIdMap] || item.id || Symbol('ITEM_ID');
    }

    getNextItem(item = {}) {
        return this.items[this.getItemIndex(item) + 1] ?? this.items[0];
    }

    getPreviousItem(item = {}) {
        return this.items[this.getItemIndex(item) - 1] ?? this.items[this.items.length - 1];
    }

    removeItem(item = {}, sendUpdate = true) {
        const index = this.getItemIndex(item);
        if (index === -1) {
            return;
        }
        this.items.splice(index, 1);
        if (this.itemsById[this.itemIdMap]) {
            delete this.itemsById[this.itemIdMap];
            this._config.totalItems--;
        }
        if (sendUpdate) {
            this.signal('remove_item', item, index);
            this.signal('items_updated', this.items);
        }
    }

    removeItems(sendUpdate = true) {
        this.items = [];
        this.itemsById = {};
        this._config.totalItems = 0;
        if (sendUpdate) {
            this.signal('remove_items');
            this.signal('items_updated', this.items);
        }
    }

    updateItem(item = {}, sendUpdate = true) {
        const index = this.getItemIndex(item);
        if (index === -1) {
            return;
        }
        this.itemsById[item[this.itemIdMap]] = Object.assign(this.itemsById[item[this.itemIdMap]], item);
        if (sendUpdate) {
            this.signal('update_item', this.itemsById[item[this.itemIdMap]], index);
        }
    }

    getItemIndex(item) {
        if (typeof item[this.itemIdMap] === 'undefined') {
            return -1;
        }
        return this.items.findIndex($item => {
            return $item[this.itemIdMap] === item[this.itemIdMap];
        });
    }

    preProcessItems(items = []) {
        return items.map(item => this.preProcessItem(item));
    }

    preProcessItem(item = {}) {
        const rawItem = item;
        const { preProcessItem } = this._config;
        if (typeof preProcessItem === 'function') {
            item = preProcessItem(item);
        }
        const id = this.getItemId(item);
        item.id = id;
        item[this.itemIdMap] = id;
        this.itemsById[item[this.itemIdMap]] = item;
        this.rawItemsById[id] = rawItem;
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
            this._config.isCollapsed = this.toggleListFilter.getValue() === 'false';
        }
    }

    getFiltersURL(encode = true) {
        const filters = {};
        Object.keys(this.filters).map(filterKey => {
            const filter = this.filters[filterKey];
            if (filter.isURLFilter()) {
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

    getClearFiltersURL() {
        const filters = {};
        Object.keys(this.filters).map(filterKey => {
            const filter = this.filters[filterKey];
            if (filter.isURLFilter()) {
                filters[filter.getUrlName()] = null;
            }
        });
        if (this.searchFilter) {
            filters[this.searchFilter.getUrlName()] = undefined;
        }
        return editURL(window.location.href.replace(window.location.origin, ''), filters);
    }

    getFilterQueryParams() {
        const query = {};
        this.getFilters().map((filter = {}) => {
            if (!filter.isRequestFilter()) {
                return;
            }
            const value = filter.getValue();
            query[filter.getQueryName() || filter.getAlias() || filter.getId()] = value;
        });
        return query;
    }

    initializeFilters() {
        this.hasActiveFilter = false;
        this.activeFilters = [];
        this.getFilters().map(filter => {
            filter.initializeValue();
            const exceptions = [this.sortDirFilter, this.sortFilter];

            if (!exceptions.includes(filter) && filter.isActive()) {
                this.activeFilters.push(filter);
                this.hasActiveFilter = true;
            }
        });
    }

    addSortFilter(config = {}) {
        this.sortFilter = this.addFilter(this._config.sortByParam, {
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

    addSortDirFilter(config = {}) {
        this.sortDirFilter = this.addFilter(this._config.sortDirParam, {
            isRequestFilter: true,
            isURLFilter: true,
            defaultValue: 'asc',
            ...config
        });
        return this.sortDirFilter;
    }

    getSortDirFilter() {
        return this.sortDirFilter ?? this.addSortDirFilter();
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

    getViewFilter(config) {
        return this.viewFilter ?? this.addViewFilter(config);
    }

    addSearchFilter() {
        if (this.searchFilter) {
            return this.searchFilter;
        }
        this.searchFilter = this.addFilter(this._config.searchParam, {
            defaultValue: '',
            isRequestFilter: true
        });
        return this.searchFilter;
    }

    getSearchFilter() {
        return this.searchFilter ?? this.addSearchFilter();
    }

    hasURLFilter() {
        for (const [, filter] of Object.entries(this.filters)) {
            if (filter.isURLFilter()) {
                return true;
            }
        }
        return false;
    }

    canClearFilters() {
        for (const [, filter] of Object.entries(this.filters)) {
            if (this.canClearFilter(filter)) {
                return true;
            }
        }
        return false;
    }

    canClearFilter(filter) {
        return (
            filter.allowClear() && filter.isRequestFilter() && filter.getDefaultValue() !== filter.getValue()
        );
    }

    /**
     * Adds a filter.
     * @param {string} id - The filter ID blaasidahd asdh.
     * @param {ListFilterInterface} options
     * @returns {any}
     */
    addFilter(id, options) {
        const filter = new ListFilter(id, options);
        this.filters[filter.key] = filter;
        return filter;
    }

    setFilter(name, value = undefined) {
        const filter = this.filters[name];
        if (typeof filter !== 'undefined') {
            filter.setValue(value);
        }
        return this;
    }

    removeFilter(name) {
        let id = name;
        if (typeof this.filters[name] !== 'undefined') {
            id = this.filters[name].id;
            delete this.filters[name];
        }
        localStorage.removeItem(id);
    }

    getFilter(name) {
        return this.filters[name];
    }

    getFilters() {
        return Object.values(this.filters);
    }

    getFilterValues() {
        const values = {};
        this.getFilters().map((filter = {}) => {
            values[filter.getAlias() || filter.getId()] = filter.getValue();
        });
        return values;
    }

    getFilterSignature() {
        return JSON.stringify(this.getFilterValues());
    }

    paginate(itemsPerPage = this.getPerPage()) {
        this.pageFilter = this.addFilter(this.id + '-page', {
            defaultValue: 1,
            isURLFilter: true,
            isRequestFilter: true,
            urlParamName: this._config.pageParam,
            alias: this._config.pageParam ?? 'page',
            allowClear: false,
            preProcessQueryParam: value => (parseInt(value, 10) || 1) - 1,
            callback: page => (this._config.currentPage = parseInt(page, 10))
        });
        this.perPageFilter = this.addFilter(this.id + '-size', {
            defaultValue: itemsPerPage,
            hasLocalStorage: false,
            alias: this._config.perPageParam ?? 'size',
            urlParamName: this._config.perPageParam,
            queryName: this._config.perPageParam,
            isURLFilter: true,
            isRequestFilter: true,
            allowClear: false
        });
        return this;
    }

    nextPage() {
        const page = this.getNextPage();
        Context.Router.go(
            editURL(window.location.href, {
                [this._config.pageParam]: page
            })
        );
        this.pageFilter.setValue(page);
    }

    previousPage() {
        const page = this.getPreviousPage();
        Context.Router.go(
            editURL(window.location.href, {
                [this._config.pageParam]: page
            })
        );
        this.pageFilter.setValue(page);
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
        this.pageFilter.setValue(page);
    }

    clearFilters(sendUpdate = false) {
        this.clearFilterValues(true);
        this.hasActiveFilter = false;
        this.pageFilter?.resetValue(sendUpdate);
        const url = this.getClearFiltersURL();
        Context.Router.go(url);
    }

    clearFilterValues(sendUpdate = false) {
        Object.keys(this.filters).map(filterKey => {
            const filter = this.filters[filterKey];
            if (filter.allowClear()) {
                filter.resetValue(sendUpdate);
            }
        });
    }

    // #endregion

    // #region SELECTION API.

    initializeSelectedItems() {
        this.selectedItems = this.getSelectedItems();
        this.selectedItemsById = {};
        this.selectedItems.map(item => (this.selectedItemsById[this.getItemId(item)] = item));
        return this;
    }

    hasSelections() {
        return Boolean(this.selectedItems.length);
    }

    isItemSelectable() {
        return this.hasSelection();
    }

    hasSelectableItems() {
        for (const item in this.items) {
            if (this.isItemSelectable(this.items[item])) {
                return true;
            }
        }
        return false;
    }

    getSelectableItems() {
        return this.items.filter(item => this.isItemSelectable(item));
    }

    getSelectedItems() {
        return this.hasSelectionSave() ? this.getSavedSelections() : this.selectedItems ?? [];
    }

    getSavedSelections() {
        return JSON.parse(localStorage.getItem(this.selectionKey)) || [];
    }

    setSelectedItems(items = []) {
        this.selectedItems = items;
        if (this.hasSelectionSave()) {
            localStorage.setItem(this.selectionKey, JSON.stringify(items));
            localStorage.setItem(this.selectionLengthKey, items.length);
        }
    }

    getSelectedIds() {
        const items = this.getSelectedItems();
        const rv = [];
        items.map(item => item[this.itemIdMap] && rv.push(item[this.itemIdMap]));
        return rv;
    }

    getSelectedCount() {
        if (this.hasSelectionSave()) {
            return parseInt(localStorage.getItem(this.selectionLengthKey), 10);
        }
        return this.selectedItems.length;
    }

    hasPartialSelection() {
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
        const itemID = this.getItemId(item);
        return Boolean(itemID && this.selectedItemsById[itemID]);
    }

    selectItem(item = {}, items, callOnChange = true) {
        if (this.isSelected(item) || (this.hasSelection() && !this.isItemSelectable(item))) {
            return this;
        }
        item = this.preProcessSelectionItem(item);
        items = items || this.getSelectedItems();
        items.push(item);
        this.setSelectedItems(items);
        const itemID = this.getItemId(item);
        this.selectedItemsById[itemID] = item;
        this.signal(`item_selected_${itemID}`, true);
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems);
        }
        return this;
    }

    deselectItem(item = {}, callOnChange = true) {
        if (!this.isSelected(item)) {
            return;
        }
        const itemID = this.getItemId(item);
        delete this.selectedItemsById[itemID];
        this.setSelectedItems(Object.values(this.selectedItemsById));
        this.signal(`item_deselected_${itemID}`, false);
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems.length);
        }
        return this;
    }

    toggleItem(item = {}, callOnChange = true) {
        if (!this.isSelected(item)) {
            this.selectItem(item, null, false);
        } else {
            this.deselectItem(item, false);
        }
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems.length);
        }
        return this;
    }

    /**
     * Changes the state of all selections.
     * @param {*} selected
     * @param {*} callOnChange
     * @returns {this}
     */
    setSelections(selected, callOnChange = true) {
        if (selected) {
            this.items.map(item => this.selectItem(item, null, false));
        } else {
            this.items.map(item => this.deselectItem(item, false));
        }
        if (callOnChange) {
            this.signal('selection_change', this.selectedItems.length);
        }
        return this;
    }

    toggleSelections() {
        let value = false;
        for (const item of this.items) {
            if (this.isItemSelectable(item) && !this.isSelected(item)) {
                value = true;
                break;
            }
        }
        this.setSelections(value);
        return value;
    }

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
            localStorage.removeItem(this.selectionKey);
            localStorage.removeItem(this.selectionLengthKey);
            localStorage.removeItem(this.selectionRedirectKey);
        }
        this.selectedItems.forEach(item => this.signal(`item_deselected_${item.id}`));
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
        this._initializePayload(payload, {}, false);
        this.update();
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

    // #endregion
}

export default ListResource;
