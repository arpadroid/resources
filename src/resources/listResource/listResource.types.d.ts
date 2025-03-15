import type { Router } from '@arpadroid/services';
import { ResourceConfigType } from '../resource/resource.types';
import { ListFilterOptionsType } from './listFilter.types';
import { ElementType } from '@arpadroid/tools';

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
    itemIdMap?: string;
    preProcessItem?: (_item: ListResourceItemType) => ListResourceItemType;
    preProcessNode?: (_node: ListResourceItemNodeType | undefined) => ListResourceItemNodeType | undefined;
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
    node?: ListResourceItemNodeType;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;


export type ListResourceItemNodeType =  ElementType;