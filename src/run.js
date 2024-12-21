(function () {
    let style = document.createElement('style');
    document.head.appendChild(style);
    style.sheet.insertRule(`
      @keyframes anim-line {
        from {
            background-color: rgba(142, 142, 142, 1);
        }
        to {
            background-color: rgba(142, 142, 142, 0);
        }
    }`, style.sheet.cssRules.length);
})();
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "./gemini.mjs";
const SafeSetting = Object.values(HarmCategory).map((category) => ({
    category,
    threshold: HarmBlockThreshold.BLOCK_NONE,
}));
export class GenText {
    constructor(toId, space = 20, initial = true) {
        this.toId = toId;
        this.text_node = null;
        this.speed = space;
        this.line = null;
        this.callback = null;
        if (initial) this.init();
    }
    async sleep(delay) {
        return new Promise((resolve) => setTimeout(resolve, delay));
    }
    setCallBack(pfn) {
        this.callback = pfn;
    }
    createLine() {
        let elm = document.createElement("span");
        elm.innerHTML = "&thinsp;";
        elm.style.backgroundColor = "rgba(142, 142, 142,1)";
        elm.style.animation = "anim-line 0.5s ease-in-out infinite alternate";
        elm.style.fontSize = "15px";
        elm.style.color = "white";
        return elm;
    }
    init() {
        this.text_node = document.createElement("span");
        //this.text_node.contentEditable = "true";
        document.getElementById(this.toId).appendChild(this.text_node);
        this.line = this.createLine();
        this.line.hidden = true;
        document.getElementById(this.toId).appendChild(this.line);
        this.text_node.innerText = "";
    }
    appendTextNoDelay(text) {
        this.text_node.innerText += text;
    }
    async appendText(text, clear = false) {
        if (clear) this.text_node.innerText = "";
        for (let i = 0; i < text.length; i++) {
            this.text_node.innerText += text[i];
            await this.sleep(this.speed);
        }
    }
    finish() {
        this.line.hidden = true;
        if (this.callback) this.callback(this);
    }
    show() {
        this.line.hidden = false;
    }
}
export class GenAI {
    constructor(model_name = "gemini-1.5-flash", key = [], sys_msg = "") {
        this.name = model_name;
        this.key = key;
        this.models = [];
        this.itr = 0;
        this.limit = 0;
        this.history = [];
        this.system = sys_msg;
        this._input = null;
        this._proxy = null;
        this._callback = null;
        this.max_out_token = 8192;
        this.param = [0.9, 0.95, 16];//temperature,top p,top k;
        if (!key) throw new Error("require key !");
        this.init();
    }
    clear() {
        this.history = [];
        this._proxy = null;
        this._input = null;
    }
    setModel(model_name) {
        this.name = model_name;
        this.setSystemMessage("");
    }
    setParameters(temperature = 0.9, topP = 0.95, topK = 16) {
        this.param = [temperature, topP, topK];
    }
    setLimit(value) {
        this.limit = value;
    }
    roll() {
        return this.itr = (this.itr + 1) % this.key.length;
    }
    createMessage(role_type, msg) {//"user","model"
        return { role: role_type, parts: [{ text: msg }] };
    }
    setCallBack(callback_) {
        this._callback = callback_;
    }
    setSystemMessage(text) {
        this.system = text;
        this.models = [];
        this.init();
    }
    getRollModel() {
        return this.models[this.roll()];
    }
    init() {//"gemini-1.5-pro-002,gemini-exp-1121
        for (let i = 0; i < this.key.length; ++i)
            this.models.push((new GoogleGenerativeAI(this.key[i])).getGenerativeModel({ model: this.name, SafeSetting, systemInstruction: this.system }));
    }
    setInput(text) {
        this._input = text;
    }
    edit(history_index = null, new_text = null, role = null) {//null -> default
        if (history_index && history_index >= 0) {
            if (new_text) this.history[history_index].parts[0].text = new_text;
            if (role) this.history[history_index].role = role;
        }
    }
    applyTextChange(proxy, index) {
        this.history[index].parts[0].text = proxy.text_node.innerText;
    }
    popMessage() {
        return this.history.pop();
    }
    addMessage(role_type, message) {
        this.history.push(this.createMessage(role_type, message));
    }
    removeMessage(index = -1, count = 1) {
        if (index >= 0) this.history.splice(index, count);
        else this.history.splice(this.history.length + index, count);
    }
    async reSubmit(proxy = null, first_user = false) {
        if (!this._input || !this._proxy && !proxy) throw new Error("Submit at least once.");
        if (!first_user) this.popMessage();
        this.popMessage();
        return await this.submit(proxy || this._proxy);
    }
    async submit(proxy_gentext_object, only_model = false) {
        let _history = this.history;
        if (this.limit > 0 && this.history.length > this.limit) _history = this.history.slice(this.history.length - this.limit, this.history.length);
        this._proxy = proxy_gentext_object;
        this._proxy.show();
        let model = null;
        try {
            model = this.getRollModel();
            const chat = model.startChat({
                history: _history,
                generationConfig: {
                    maxOutputTokens: this.max_out_token,
                    temperature: this.param[0],
                    topP: this.param[1],
                    topK: this.param[2],
                },
            });
            const result = await chat.sendMessageStream(this._input);
            let text = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (this._proxy) await this._proxy.appendText(chunkText);
                else console.log(chunkText);
                text += chunkText;
                if (this._callback) this._callback(this);
            }
            this._proxy.finish();
            if (!only_model) this.history.push(this.createMessage("user", this._input));
            this.history.push(this.createMessage("model", text));
        } catch (e) {
            console.log(model);
            throw new Error(e);
        }
        return true;
    }
    setProxy(proxy) {
        this._proxy = proxy;
    }
    async postMessage(text, proxy = null) {
        if (proxy) this._proxy = proxy;
        if (!this._proxy) return false;
        this.setInput(text);
        return await this.submit(this._proxy);
    }
}
export function createAI(model_name = "gemini-1.5-flash", key = [], sys_msg = "") {
    return new GenAI(model_name, key, sys_msg);
}
//example
// let ai = createAI("gemini-1.5-flash",["API_KEY"])
// ai.setProxy(new GenText("chat"));
// ai.postMessage("Hello, world!");