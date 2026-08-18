export type NativePickedFile = {
  uri: string;
  name: string;
  mimeType: string;
};

export type NativeFormDataFilePart = {
  uri: string;
  name: string;
  type: string;
};

export function nativeFilePart(file: NativePickedFile): NativeFormDataFilePart {
  return { uri: file.uri, name: file.name, type: file.mimeType };
}

export function createNativeFileFormData(fieldName: string, files: readonly NativePickedFile[]) {
  const form = new FormData();
  const nativeForm = form as FormData & { append(name: string, value: NativeFormDataFilePart): void };
  for (const file of files) nativeForm.append(fieldName, nativeFilePart(file));
  return form;
}
