import { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DragUpdate,
} from "react-beautiful-dnd";
import { nanoid } from "nanoid";
import {
  Folder as FolderIcon,
  File,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash,
  Loader,
} from "lucide-react";
import type { Item, Folder } from "./types";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const COLLECTION_NAMES = {
  ITEMS: "items",
  FOLDERS: "folders",
};

const TYPES = {
  ITEM: "ITEM",
  FOLDER: "FOLDER",
};

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [draggingOver, setDraggingOver] = useState<string | null>(null);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [loadingFolderId, setLoadingFolderId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const itemsSnapshot = await getDocs(
          collection(db, COLLECTION_NAMES.ITEMS)
        );
        const foldersSnapshot = await getDocs(
          collection(db, COLLECTION_NAMES.FOLDERS)
        );

        const itemsData = itemsSnapshot.docs.map((doc) => doc.data() as Item);
        const foldersData = foldersSnapshot.docs.map(
          (doc) => doc.data() as Folder
        );

        setItems(itemsData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        setFolders(foldersData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      } catch (error) {
        console.error("Error fetching data from Firestore:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId, type } = result;

    setDraggingOver(null);

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (type === "FOLDER") {
      const currentFolders = Array.from(folders);
      const reorderedFolders = Array.from(folders);
      const [movedFolder] = reorderedFolders.splice(source.index, 1);
      reorderedFolders.splice(destination.index, 0, movedFolder);

      const updatedFolders = reorderedFolders.map((folder, index) => ({
        ...folder,
        order: index,
      }));

      setFolders(updatedFolders);

      try {
        const batch = writeBatch(db);
        updatedFolders.forEach((folder) => {
          const folderRef = doc(db, COLLECTION_NAMES.FOLDERS, folder.id);
          batch.update(folderRef, { order: folder.order });
        });
        await batch.commit();
      } catch (error) {
        console.error("Error updating folder order in Firestore:", error);
        setFolders(currentFolders);
      }
      return;
    }

    const currentItems = Array.from(items);
    let itemsToUpdateInFirestore: Item[] = [];

    const movedItemIndex = currentItems.findIndex(
      (item) => item.id === draggableId
    );
    if (movedItemIndex === -1) return;

    const movedItem = { ...currentItems[movedItemIndex] };

    const sourceFolderId =
      source.droppableId === "main" ? null : source.droppableId;
    const destinationFolderId =
      destination.droppableId === "main" ? null : destination.droppableId;

    movedItem.folderId = destinationFolderId;

    let nextItems = [...currentItems];
    nextItems.splice(movedItemIndex, 1);

    const destinationItems = nextItems
      .filter((item) => item.folderId === destinationFolderId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    destinationItems.splice(destination.index, 0, movedItem);

    const updatedDestinationItems = destinationItems.map((item, index) => ({
      ...item,
      order: index,
    }));
    itemsToUpdateInFirestore.push(...updatedDestinationItems);

    let updatedSourceItems: Item[] = [];
    if (sourceFolderId !== destinationFolderId) {
      const sourceItems = nextItems
        .filter((item) => item.folderId === sourceFolderId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      updatedSourceItems = sourceItems.map((item, index) => ({
        ...item,
        order: index,
      }));
      itemsToUpdateInFirestore.push(...updatedSourceItems);
    }

    const otherItems = nextItems.filter(
      (item) =>
        item.folderId !== sourceFolderId &&
        item.folderId !== destinationFolderId
    );

    const finalItemsState = [
      ...otherItems,
      ...updatedSourceItems,
      ...updatedDestinationItems,
    ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    setItems(finalItemsState);

    try {
      const batch = writeBatch(db);
      itemsToUpdateInFirestore.forEach((item) => {
        const itemRef = doc(db, COLLECTION_NAMES.ITEMS, item.id);
        batch.set(
          itemRef,
          { folderId: item.folderId, order: item.order },
          { merge: true }
        );
      });
      await batch.commit();
    } catch (error) {
      console.error("Error updating item order/folder in Firestore:", error);
      setItems(currentItems);
    }
  };

  const handleDragUpdate = (update: DragUpdate) => {
    if (!update.destination) {
      setDraggingOver(null);
      return;
    }

    const droppableId = update.destination.droppableId;

    if (
      droppableId !== "main" &&
      droppableId !== "folders" &&
      update.type === TYPES.ITEM
    ) {
      const folderToOpen = folders.find(
        (f) => f.id === droppableId && !f.isOpen
      );
      if (folderToOpen) {
        setDraggingOver(droppableId);
        setFolders((currentFolders) =>
          currentFolders.map((folder) =>
            folder.id === droppableId ? { ...folder, isOpen: true } : folder
          )
        );
      } else {
        setDraggingOver(droppableId);
      }
    } else {
      setDraggingOver(null);
    }
  };

  const toggleFolder = async (folderId: string) => {
    const originalFolders = [...folders];
    let newIsOpenState: boolean | undefined;

    const updatedFolders = await folders.map((folder) => {
      if (folder.id === folderId) {
        newIsOpenState = !folder.isOpen;
        return { ...folder, isOpen: newIsOpenState };
      }
      return folder;
    });

    setFolders(updatedFolders);

    if (newIsOpenState !== undefined) {
      try {
        await updateDoc(doc(db, COLLECTION_NAMES.FOLDERS, folderId), {
          isOpen: newIsOpenState,
        });
      } catch (error) {
        console.error("Error updating folder state in Firestore:", error);
        setFolders(originalFolders);
      }
    }
  };

  const addNewItem = async (targetFolderId: string | null = null) => {
    if (!newItemTitle.trim()) return;

    setAddingItem(true);

    const itemsInScope = items.filter(
      (item) => item.folderId === targetFolderId
    );
    const newOrder =
      itemsInScope.length > 0
        ? Math.max(...itemsInScope.map((item) => item.order ?? 0)) + 1
        : 0;

    const newItem: Item = {
      id: nanoid(),
      title: newItemTitle,
      icon: "file",
      folderId: targetFolderId,
      order: newOrder,
    };

    try {
      await setDoc(
        doc(collection(db, COLLECTION_NAMES.ITEMS), newItem.id),
        newItem
      );
      setItems((prevItems) =>
        [...prevItems, newItem].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      );
      setNewItemTitle("");
    } catch (error) {
      console.error("Error adding new item to Firestore:", error);
    } finally {
      setAddingItem(false);
    }
  };

  const addNewFolder = async () => {
    if (!newFolderName.trim()) return;

    setAddingFolder(true);

    const newOrder =
      folders.length > 0
        ? Math.max(...folders.map((folder) => folder.order ?? 0)) + 1
        : 0;

    const newFolder: Folder = {
      id: nanoid(),
      name: newFolderName,
      isOpen: false,
      order: newOrder,
    };

    try {
      await setDoc(
        doc(collection(db, COLLECTION_NAMES.FOLDERS), newFolder.id),
        newFolder
      );
      setFolders((prevFolders) =>
        [...prevFolders, newFolder].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        )
      );
      setNewFolderName("");
    } catch (error) {
      console.error("Error adding new folder to Firestore:", error);
    } finally {
      setAddingFolder(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    const itemToDelete = items.find((item) => item.id === itemId);
    if (!itemToDelete) return;

    const { folderId } = itemToDelete;
    setLoadingItemId(itemId);
    const originalItems = [...items];

    try {
      let updatedItems = items.filter((item) => item.id !== itemId);

      const itemsInSameContainer = updatedItems
        .filter((item) => item.folderId === folderId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const reorderedItems = itemsInSameContainer.map((item, index) => ({
        ...item,
        order: index,
      }));

      updatedItems = updatedItems
        .filter((item) => item.folderId !== folderId)
        .concat(reorderedItems);

      setItems(updatedItems);

      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTION_NAMES.ITEMS, itemId));
      reorderedItems.forEach((item) => {
        const itemRef = doc(db, COLLECTION_NAMES.ITEMS, item.id);
        batch.update(itemRef, { order: item.order });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error deleting item or updating order:", error);
      setItems(originalItems);
    } finally {
      setLoadingItemId(null);
    }
  };

  const deleteFolder = async (folderId: string) => {
    const itemsInFolder = items.filter((item) => item.folderId === folderId);
    if (itemsInFolder.length > 0) {
      alert(
        "Cannot delete folder with items inside. Please move or delete all items first."
      );
      return;
    }

    setLoadingFolderId(folderId);
    const originalFolders = [...folders];

    try {
      let updatedFolders = folders.filter((folder) => folder.id !== folderId);

      const reorderedFolders = updatedFolders
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((folder, index) => ({
          ...folder,
          order: index,
        }));

      setFolders(reorderedFolders);

      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTION_NAMES.FOLDERS, folderId));
      reorderedFolders.forEach((folder) => {
        const folderRef = doc(db, COLLECTION_NAMES.FOLDERS, folder.id);
        batch.update(folderRef, { order: folder.order });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error deleting folder or updating order:", error);
      setFolders(originalFolders);
    } finally {
      setLoadingFolderId(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader className="animate-spin h-10 w-10 text-blue-500" />
      </div>
    );
  }

  const getSortedItems = (folderId: string | null) => {
    return items
      .filter((item) => item.folderId === folderId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Item Manager</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label
              htmlFor="newItem"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Add New Item
            </label>
            <div className="flex items-center gap-2">
              <input
                id="newItem"
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Item title"
                className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                onKeyDown={(e) => e.key === "Enter" && addNewItem(null)}
              />
              <button
                onClick={() => addNewItem(null)}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center justify-center disabled:opacity-50"
                disabled={addingItem || !newItemTitle.trim()}
              >
                <span className="inline-flex items-center">
                  {addingItem ? (
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                  ) : (
                    <Plus className="inline-block mr-1 h-4 w-4" />
                  )}
                  Add
                </span>
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="newFolder"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Add New Folder
            </label>
            <div className="flex items-center gap-2">
              <input
                id="newFolder"
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                onKeyDown={(e) => e.key === "Enter" && addNewFolder()}
              />
              <button
                onClick={addNewFolder}
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 flex items-center justify-center disabled:opacity-50"
                disabled={addingFolder || !newFolderName.trim()}
              >
                <span className="inline-flex items-center">
                  {addingFolder ? (
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                  ) : (
                    <FolderIcon className="inline-block mr-1 h-4 w-4" />
                  )}
                  Add
                </span>
              </button>
            </div>
          </div>
        </div>

        <DragDropContext
          onDragEnd={handleDragEnd}
          onDragUpdate={handleDragUpdate}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-600">
              Folders
            </h2>
            <Droppable droppableId="folders" type={TYPES.FOLDER}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 ${
                    snapshot.isDraggingOver
                      ? "bg-green-50 rounded-lg p-2 ring-1 ring-green-200"
                      : ""
                  }`}
                >
                  {folders
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((folder, index) => (
                      <Draggable
                        key={folder.id}
                        draggableId={folder.id}
                        index={index}
                      >
                        {(providedDraggable, snapshotDraggable) => (
                          <div
                            ref={providedDraggable.innerRef}
                            {...providedDraggable.draggableProps}
                            className={`border border-gray-200 rounded-lg overflow-hidden transition-shadow duration-200 ${
                              snapshotDraggable.isDragging
                                ? "shadow-lg bg-white"
                                : "bg-gray-50"
                            }`}
                          >
                            <div
                              {...providedDraggable.dragHandleProps}
                              className={`flex items-center p-3 cursor-grab border-b border-gray-200 ${
                                snapshotDraggable.isDragging
                                  ? "bg-green-100"
                                  : "bg-gray-100 hover:bg-gray-200"
                              } ${
                                draggingOver === folder.id ? "bg-green-200" : ""
                              }`}
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                if (
                                  target.closest("button") ||
                                  target.closest(
                                    'span[data-toggle-icon="true"]'
                                  )
                                )
                                  return;
                                toggleFolder(folder.id);
                              }}
                              style={{ cursor: "pointer" }}
                            >
                              <span
                                className="cursor-pointer"
                                data-toggle-icon="true"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFolder(folder.id);
                                }}
                              >
                                {folder.isOpen ? (
                                  <ChevronDown className="h-5 w-5 mr-2 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 mr-2 text-gray-500" />
                                )}
                              </span>
                              <FolderIcon className="h-5 w-5 mr-2 text-yellow-500 flex-shrink-0" />
                              <span className="font-medium text-gray-800 truncate flex-grow mr-2">
                                {folder.name}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    items.some((i) => i.folderId === folder.id)
                                  ) {
                                    alert(
                                      "Cannot delete folder with items inside. Please move or delete all items first."
                                    );
                                  } else if (loadingFolderId === folder.id) {
                                    alert("Folder is currently being deleted.");
                                  } else {
                                    deleteFolder(folder.id);
                                  }
                                }}
                                className="ml-auto text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 flex items-center justify-center"
                                style={{ cursor: "pointer" }}
                                title="Delete folder"
                              >
                                {loadingFolderId === folder.id ? (
                                  <Loader className="animate-spin h-4 w-4" />
                                ) : (
                                  <Trash className="h-4 w-4" />
                                )}
                              </button>
                            </div>

                            <Droppable
                              droppableId={folder.id}
                              type={TYPES.ITEM}
                            >
                              {(providedDroppable, snapshotDroppable) => (
                                <div
                                  ref={providedDroppable.innerRef}
                                  {...providedDroppable.droppableProps}
                                  className={`transition-all duration-300 ease-in-out ${
                                    folder.isOpen
                                      ? "p-3 space-y-2 min-h-[50px] bg-white"
                                      : "h-0 overflow-hidden"
                                  } ${
                                    snapshotDroppable.isDraggingOver
                                      ? "bg-blue-50 ring-1 ring-blue-200 rounded-b-md"
                                      : ""
                                  }`}
                                >
                                  {folder.isOpen &&
                                    getSortedItems(folder.id).map(
                                      (item, index) => (
                                        <Draggable
                                          key={item.id}
                                          draggableId={item.id}
                                          index={index}
                                        >
                                          {(providedItem, snapshotItem) => (
                                            <div
                                              ref={providedItem.innerRef}
                                              {...providedItem.draggableProps}
                                              {...providedItem.dragHandleProps}
                                              className={`flex items-center p-2 rounded border cursor-grab transition-shadow duration-200 ${
                                                snapshotItem.isDragging
                                                  ? "bg-blue-100 border-blue-300 shadow-md"
                                                  : "bg-white border-gray-200 hover:bg-gray-50"
                                              }`}
                                            >
                                              <File className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                                              <span className="text-sm text-gray-700 truncate flex-grow mr-2">
                                                {item.title}
                                              </span>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (
                                                    loadingItemId === item.id
                                                  ) {
                                                    alert(
                                                      "Item is currently being deleted."
                                                    );
                                                  } else {
                                                    deleteItem(item.id);
                                                  }
                                                }}
                                                className="ml-auto text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 flex items-center justify-center"
                                                style={{ cursor: "pointer" }}
                                                title="Delete item"
                                              >
                                                {loadingItemId === item.id ? (
                                                  <Loader className="animate-spin h-3 w-3" />
                                                ) : (
                                                  <Trash className="h-3 w-3" />
                                                )}
                                              </button>
                                            </div>
                                          )}
                                        </Draggable>
                                      )
                                    )}
                                  {providedDroppable.placeholder}
                                  {folder.isOpen &&
                                    getSortedItems(folder.id).length === 0 &&
                                    !snapshotDroppable.isDraggingOver && (
                                      <div className="text-center text-xs text-gray-400 py-2">
                                        Empty folder
                                      </div>
                                    )}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                  {folders.length === 0 && !snapshot.isDraggingOver && (
                    <div className="text-center text-gray-500 py-4">
                      No folders yet. Add one above!
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3 text-gray-600">Items</h2>
            <Droppable droppableId="main" type={TYPES.ITEM}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 min-h-[100px] p-4 border-2 border-dashed rounded-lg transition-colors duration-200 ${
                    snapshot.isDraggingOver
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  {getSortedItems(null).map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={item.id}
                      index={index}
                    >
                      {(providedItem, snapshotItem) => (
                        <div
                          ref={providedItem.innerRef}
                          {...providedItem.draggableProps}
                          {...providedItem.dragHandleProps}
                          className={`flex items-center p-2 rounded border cursor-grab transition-shadow duration-200 ${
                            snapshotItem.isDragging
                              ? "bg-blue-100 border-blue-300 shadow-md"
                              : "bg-white border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <File className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate flex-grow mr-2">
                            {item.title}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (loadingItemId === item.id) {
                                alert("Item is currently being deleted.");
                              } else {
                                deleteItem(item.id);
                              }
                            }}
                            className="ml-auto text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 flex items-center justify-center"
                            style={{ cursor: "pointer" }}
                            title="Delete item"
                          >
                            {loadingItemId === item.id ? (
                              <Loader className="animate-spin h-3 w-3" />
                            ) : (
                              <Trash className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {getSortedItems(null).length === 0 &&
                    !snapshot.isDraggingOver && (
                      <div className="text-center text-gray-500 py-4">
                        Drag items here or add a new one above.
                      </div>
                    )}
                </div>
              )}
            </Droppable>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

export default App;
