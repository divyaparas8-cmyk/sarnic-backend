import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto;
}

import { Storage } from "megajs";

const megaEmail = "ltlalit15@gmail.com";
const megaPassword = "lalitbook@123";

export const uploadToMega = async (fileBuffer, fileName, folderName = "") => {
  return new Promise((resolve, reject) => {
    const storage = new Storage({
      email: megaEmail,
      password: megaPassword
    });

    storage.on("ready", async () => {
      try {
        let targetFolder = storage.root;

        if (folderName) {
          const existingFolder = targetFolder.children.find(
            f => f.name === folderName && f.directory
          );

          if (existingFolder) {
            targetFolder = existingFolder;
          } else {
            targetFolder = await new Promise((res, rej) => {
              const newFolder = targetFolder.mkdir(folderName);
              newFolder.on("ready", () => res(newFolder));
              newFolder.on("error", rej);
            });
          }
        }

        const uploadStream = targetFolder.upload(fileName, fileBuffer);

        uploadStream.on("complete", async () => {
          // ✅ Find the file we just uploaded
          const uploadedFile = targetFolder.children.find(f => f.name === fileName);
          if (!uploadedFile) return reject(new Error("Upload complete but file not found in folder."));
          
          uploadedFile.link((err, link) => {
            if (err) return reject(err);
            resolve(link); // ✅ Return the public link
          });
        });

        uploadStream.on("error", reject);
      } catch (err) {
        reject(err);
      }
    });

    storage.on("error", reject);
  });
};
 