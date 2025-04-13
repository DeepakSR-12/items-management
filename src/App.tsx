import { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { nanoid } from "nanoid";
import {
  Folder as FolderIcon,
  File,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { Item, Folder } from "./types";

const LOCAL_STORAGE_KEYS = {
  ITEMS: "items",
  FOLDERS: "folders",
};

function App() {
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const storedItems = localStorage.getItem(LOCAL_STORAGE_KEYS.ITEMS);
      return storedItems ? JSON.parse(storedItems) : [];
    } catch (error) {
      console.error("Error loading items from local storage:", error);
      return [];
    }
  });
  const [folders, setFolders] = useState<Folder[]>(() => {
    try {
      const storedFolders = localStorage.getItem(LOCAL_STORAGE_KEYS.FOLDERS);
      return storedFolders ? JSON.parse(storedFolders) : [];
    } catch (error) {
      console.error("Error loading folders from local storage:", error);
      return [];
    }
  });

  const [newItemTitle, setNewItemTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [draggingOver, setDraggingOver] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } catch (error) {
      console.error("Error saving items to local storage:", error);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
    } catch (error) {
      console.error("Error saving folders to local storage:", error);
    }
  }, [folders]);

  const handleDragEnd = (result: DropResult) => {
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
      const reorderedFolders = Array.from(folders);
      const [removed] = reorderedFolders.splice(source.index, 1);
      reorderedFolders.splice(destination.index, 0, removed);
      setFolders(reorderedFolders);
      return;
    }

    const allItems = Array.from(items);
    const itemToMove = allItems.find((item) => item.id === draggableId);

    if (!itemToMove) return;

    const newItems = allItems.filter((item) => item.id !== draggableId);

    const newFolderId =
      destination.droppableId === "main" ? null : destination.droppableId;

    const updatedItem = {
      ...itemToMove,
      folderId: newFolderId,
    };

    const itemsInDestination = newItems.filter((item) =>
      destination.droppableId === "main"
        ? item.folderId === null
        : item.folderId === destination.droppableId
    );

    itemsInDestination.splice(destination.index, 0, updatedItem);

    const finalItems = [
      ...newItems.filter((item) =>
        destination.droppableId === "main"
          ? item.folderId !== null
          : item.folderId !== destination.droppableId
      ),
      ...itemsInDestination,
    ];

    setItems(finalItems);
  };

  const handleDragUpdate = (result: any) => {
    if (!result.destination) {
      setDraggingOver(null);
      return;
    }

    const droppableId = result.destination.droppableId;

    if (droppableId !== "main" && droppableId !== "folders") {
      setDraggingOver(droppableId);

      setFolders(
        folders.map((folder) =>
          folder.id === droppableId ? { ...folder, isOpen: true } : folder
        )
      );
    } else {
      setDraggingOver(null);
    }
  };

  const toggleFolder = (folderId: string) => {
    setFolders(
      folders.map((folder) =>
        folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
      )
    );
  };

  const addNewItem = () => {
    if (!newItemTitle.trim()) return;

    const newItem: Item = {
      id: nanoid(),
      title: newItemTitle,
      icon: "file",
      folderId: null,
    };

    setItems([...items, newItem]);
    setNewItemTitle("");
  };

  const addNewFolder = () => {
    if (!newFolderName.trim()) return;

    const newFolder: Folder = {
      id: nanoid(),
      name: newFolderName,
      isOpen: true,
    };

    setFolders([...folders, newFolder]);
    setNewFolderName("");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Item Manager</h1>

        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="New item title"
              className="w-full px-3 py-2 border rounded"
            />
            <button
              onClick={addNewItem}
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              <Plus className="inline-block mr-2 h-4 w-4" />
              Add Item
            </button>
          </div>

          <div className="flex-1">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              className="w-full px-3 py-2 border rounded"
            />
            <button
              onClick={addNewFolder}
              className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              <FolderIcon className="inline-block mr-2 h-4 w-4" />
              Add Folder
            </button>
          </div>
        </div>

        <DragDropContext
          onDragEnd={handleDragEnd}
          onDragUpdate={handleDragUpdate}
        >
          <div className="mb-6">
            <Droppable droppableId="main" type="ITEM">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 min-h-[100px] p-4 border-2 border-dashed rounded-lg ${
                    snapshot.isDraggingOver
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  {items
                    .filter((item) => !item.folderId)
                    .map((item, index) => (
                      <Draggable
                        key={item.id}
                        draggableId={item.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`flex items-center p-3 rounded border ${
                              snapshot.isDragging
                                ? "bg-blue-100 border-blue-300 shadow-lg"
                                : "bg-gray-50 hover:bg-gray-100"
                            }`}
                          >
                            <File className="h-5 w-5 mr-3 text-gray-500" />
                            <span>{item.title}</span>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          <Droppable droppableId="folders" type="FOLDER">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`space-y-4 ${
                  snapshot.isDraggingOver ? "bg-green-50 rounded-lg p-2" : ""
                }`}
              >
                {folders.map((folder, index) => (
                  <Draggable
                    key={folder.id}
                    draggableId={folder.id}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`border rounded-lg overflow-hidden ${
                          snapshot.isDragging ? "shadow-xl" : ""
                        }`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className={`flex items-center p-3 cursor-pointer ${
                            snapshot.isDragging ? "bg-green-100" : "bg-gray-100"
                          } ${
                            draggingOver === folder.id ? "bg-green-200" : ""
                          }`}
                          onClick={() => toggleFolder(folder.id)}
                        >
                          {folder.isOpen ? (
                            <ChevronDown className="h-5 w-5 mr-2" />
                          ) : (
                            <ChevronRight className="h-5 w-5 mr-2" />
                          )}
                          <FolderIcon className="h-5 w-5 mr-3 text-yellow-500" />
                          <span className="font-medium">{folder.name}</span>
                        </div>

                        <Droppable droppableId={folder.id} type="ITEM">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`${
                                folder.isOpen
                                  ? "p-3 space-y-2 min-h-[50px]"
                                  : "h-0 overflow-hidden"
                              } ${snapshot.isDraggingOver ? "bg-blue-50" : ""}`}
                            >
                              {folder.isOpen &&
                                items
                                  .filter((item) => item.folderId === folder.id)
                                  .map((item, index) => (
                                    <Draggable
                                      key={item.id}
                                      draggableId={item.id}
                                      index={index}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`flex items-center p-3 rounded border ${
                                            snapshot.isDragging
                                              ? "bg-blue-100 border-blue-300 shadow-lg"
                                              : "bg-white hover:bg-gray-50"
                                          }`}
                                        >
                                          <File className="h-5 w-5 mr-3 text-gray-500" />
                                          <span>{item.title}</span>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}

export default App;
