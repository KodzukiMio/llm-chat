export class LocalStorageManager {
    constructor(namespace = 'app') {
        this.namespace = namespace;
    }

    /**
     * Saves a value to localStorage.  Handles various data types.
     * @param {string} key The key to store the value under.
     * @param {any} value The value to store.  Can be string, number, boolean, object, or array.
     * @throws {Error} If the key is not a string or if the value cannot be stringified.
     */
    save(key, value) {
        if (typeof key !== 'string') {
            throw new Error('Key must be a string.');
        }

        let stringifiedValue;
        try {
            stringifiedValue = JSON.stringify(value);
        } catch (error) {
            throw new Error(`Value could not be stringified: ${error.message}`);
        }

        localStorage.setItem(`${this.namespace}-${key}`, stringifiedValue);
    }

    /**
     * Retrieves a value from localStorage. Handles JSON parsing.
     * @param {string} key The key to retrieve the value for.
     * @param {any} defaultValue The value to return if the key is not found. Defaults to null.
     * @returns {any} The retrieved value, or the defaultValue if the key is not found.  Returns null if JSON parsing fails.
     * @throws {Error} If the key is not a string.
     */
    read(key, defaultValue = null) {
        if (typeof key !== 'string') {
            throw new Error('Key must be a string.');
        }

        const value = localStorage.getItem(`${this.namespace}-${key}`);
        if (value === null) {
            return defaultValue;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            console.error(`Error parsing JSON for key "${key}":`, error);
            return null; // or throw the error, depending on your error handling strategy
        }
    }

    /**
     * Removes a value from localStorage.
     * @param {string} key The key to remove.
     * @throws {Error} If the key is not a string.
     */
    remove(key) {
        if (typeof key !== 'string') {
            throw new Error('Key must be a string.');
        }
        localStorage.removeItem(`${this.namespace}-${key}`);
    }

    /**
     * Clears all values from localStorage for this namespace.
     */
    clear() {
        for (let key in localStorage) {
            if (key.startsWith(`${this.namespace}-`)) {
                localStorage.removeItem(key);
            }
        }
    }
}


// //Example Usage
// const storage = new LocalStorageManager('myApp'); //Optional namespace

// storage.save('userName', 'John Doe');
// storage.save('userAge', 30);
// storage.save('userSettings', { theme: 'dark', notifications: true });

// console.log(storage.read('userName')); // John Doe
// console.log(storage.read('userAge')); // 30
// console.log(storage.read('userSettings')); // { theme: 'dark', notifications: true }
// console.log(storage.read('nonExistentKey', 'default')); // default

// storage.remove('userAge');
// console.log(storage.read('userAge')); // null

// storage.clear(); //Clears only items with namespace 'myApp'