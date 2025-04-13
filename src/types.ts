export interface Item {
  id: string;
  title: string;
  icon: string;
  folderId: string | null;
  order: number;
}

export interface Folder {
  id: string;
  name: string;
  isOpen: boolean;
  order: number;
}
