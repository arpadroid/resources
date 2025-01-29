import { Router } from '@arpadroid/services';
import { ResourceConfigType } from '../resource/resource.types';
import { ListFilterOptionsType } from './listFilter.types';

export type ListResourceConfigType = Partial<ResourceConfigType> & {
    currentPage?: number;
    hasSelection?: boolean;
    hasSelectionSave?: boolean;
    hasToggleSave?: boolean;
    isCollapsed?: boolean;
    isCollapsible?: boolean;
    isStatic?: boolean;
    itemsPerPage?: number;
    listComponent?: HTMLElement;
    pageParam?: string;
    perPageParam?: string;
    perPage?: number;
    perPageOptions?: ListFilterOptionsType[];
    mapItemId?: (_item: ListResourceItemType) => string;
    preProcessItem?: (_item: ListResourceItemType) => ListResourceItemType;
    preProcessNode?: (_node: HTMLElement) => HTMLElement;
    router?: Router;
    searchFields?: string[];
    searchParam?: string;
    sortByParam?: string;
    sortDirParam?: string;
    totalItems?: number;
    totalPages?: number;
};

export type ListResourceItemType = {
    id?: string | symbol;
    isSelected?: boolean;
    node?: HTMLElement;
} & Record<string, unknown>;
