import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { ArrowUpToLine, FolderUp } from 'lucide-react';
import type { SelectedUploadFile } from '../lib/upload.js';

export interface DropZoneProps {
  disabled?: boolean;
  onFilesSelected: (files: SelectedUploadFile[]) => void | Promise<void>;
}

export function DropZone({ disabled = false, onFilesSelected }: DropZoneProps): JSX.Element {
  const fileInputId = useId();
  const folderInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, []);

  async function handleFileList(fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0 || disabled) {
      return;
    }

    await onFilesSelected(toSelectedUploadFiles([...fileList]));
  }

  function onDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (disabled) {
      return;
    }
    setIsDragOver(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setIsDragOver(false);
  }

  async function onDrop(event: DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    setIsDragOver(false);

    if (disabled) {
      return;
    }

    const files = await getDroppedFiles(event);
    if (files.length === 0) {
      return;
    }

    await onFilesSelected(files);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    await handleFileList(event.target.files);
    event.target.value = '';
  }

  async function onFolderChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    await handleFileList(event.target.files);
    event.target.value = '';
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  }

  return (
    <div
      className={`drop-zone surface-card${isDragOver ? ' drop-zone--active' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(event) => void onDrop(event)}
      onKeyDown={onKeyDown}
      aria-disabled={disabled}
      aria-label="Upload XML policy files or folders"
      tabIndex={disabled ? -1 : 0}
    >
      <div className="drop-zone__icon" aria-hidden="true">
        <ArrowUpToLine size={28} />
      </div>
      <h2 className="drop-zone__title">Drag and drop XML files or folders here</h2>
      <p className="page-header__subtitle">
        Upload your Azure AD B2C custom policy XML files, including nested folder trees.
      </p>
      <div className="drop-zone__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => fileInputRef.current?.click()}
          aria-describedby={fileInputId}
          aria-disabled={disabled}
        >
          Select Files
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => folderInputRef.current?.click()}
          aria-describedby={folderInputId}
          aria-disabled={disabled}
        >
          <FolderUp size={16} aria-hidden="true" />
          <span>Select Folder</span>
        </button>
      </div>
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept=".xml,text/xml,application/xml"
        multiple
        hidden
        data-upload-input="files"
        onChange={(event) => void onFileChange(event)}
      />
      <input
        ref={folderInputRef}
        id={folderInputId}
        type="file"
        accept=".xml,text/xml,application/xml"
        multiple
        hidden
        data-upload-input="folder"
        onChange={(event) => void onFolderChange(event)}
      />
      <p className="drop-zone__hint">
        Supports flat uploads and nested folders; up to 200 files per upload
      </p>
    </div>
  );
}

function toSelectedUploadFiles(files: File[]): SelectedUploadFile[] {
  return files.map((file) => ({
    file,
    ...(file.webkitRelativePath ? { relativePath: file.webkitRelativePath } : {}),
  }));
}

async function getDroppedFiles(event: DragEvent<HTMLDivElement>): Promise<SelectedUploadFile[]> {
  const entryItems = [...event.dataTransfer.items]
    .map(
      (item) =>
        item as DataTransferItem & {
          webkitGetAsEntry?: () => FileSystemEntry | null;
        },
    )
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => entry !== null && entry !== undefined);

  if (entryItems.length === 0) {
    return toSelectedUploadFiles([...event.dataTransfer.files]);
  }

  const files = await Promise.all(entryItems.map((entry) => collectFilesFromEntry(entry)));
  return files.flat();
}

async function collectFilesFromEntry(
  entry: FileSystemEntry,
  parentPath = '',
): Promise<SelectedUploadFile[]> {
  if (entry.isFile) {
    const file = await readEntryFile(entry as FileSystemFileEntry);
    const relativePath = parentPath ? `${parentPath}/${file.name}` : undefined;

    return [
      {
        file,
        ...(relativePath ? { relativePath } : {}),
      },
    ];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const directoryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  const children = await readDirectoryEntries((entry as FileSystemDirectoryEntry).createReader());
  const nestedFiles = await Promise.all(
    children.map((childEntry) => collectFilesFromEntry(childEntry, directoryPath)),
  );

  return nestedFiles.flat();
}

async function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    if (batch.length === 0) {
      return entries;
    }

    entries.push(...batch);
  }
}

async function readEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}
