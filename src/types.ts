export interface Item {
  id: string;
  title: string;
  icon: string;
  folderId: string | null;
}

export interface Folder {
  id: string;
  name: string;
  isOpen: boolean;
}

export interface DragItem {
  id: string;
  type: 'ITEM' | 'FOLDER';
  index: number;
}