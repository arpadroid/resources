import { ElementType } from '@arpadroid/tools';
import { ListResourceItemType } from '../listResource/listResource.types';

export type MessageResourceConfigType = {
    messages?: [];
    iconMap?: Record<string, string>;
};

export type MessageType = ListResourceItemType & {
    someField?: string;
    node?: ElementType;
};
