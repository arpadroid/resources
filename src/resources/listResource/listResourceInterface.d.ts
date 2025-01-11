import { Router } from '@arpadroid/services';

export interface ListResourceInterface {
    pageParam?: string;
    currentPage?: number;
    itemsPerPage?: number;
    hasSelection?: boolean;
    totalPages?: number;
    totalItems?: number;
    isCollapsible?: boolean;
    isCollapsed?: boolean;
    hasToggleSave?: boolean;
    hasSelectionSave?: boolean;
    router?: Router;
}
