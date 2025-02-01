<script setup>
import { GenAI, GenText, model_type, LocalStorageManager } from './run.js';
import { ref, onMounted } from 'vue';
import {
  ElButton, ElInput, ElContainer, ElAside, ElHeader,
  ElMain, ElFooter, ElScrollbar, ElOption, ElSelect,
  ElMenu, ElNotification, ElSubMenu, ElMenuItemGroup,
  ElInputNumber, ElTable, ElTableColumn, ElDrawer
} from 'element-plus';
import { marked } from 'marked';
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
const showError = (text_obj) => ElNotification({ title: '错误', message: text_obj.toString(), type: 'error', duration: 3000 });
const showInfo = (text_obj) => ElNotification({ title: '信息', message: text_obj.toString(), type: 'info', duration: 1000 });
const showWarning = (text_obj) => ElNotification({ title: '警告', message: text_obj.toString(), type: 'warning', duration: 2000 });
const showSuccess = (text_obj) => ElNotification({ title: '成功', message: text_obj.toString(), type: 'success', duration: 1000 });
window.showError = showError;
window.showInfo = showInfo;
window.showWarning = showWarning;
window.showSuccess = showSuccess;
let ls = new LocalStorageManager("gemini-chat");
let input_value = ref('');
let global_msg = [];
let is_clear = false;
let b_lock = ref(false);
let b_mlock = ref(false);
let el_box = ref();
let v_params = null;//temperature,top-p,top-k,limit
let v_keys = null;
let r_p = null;
let v_sysmsg = ref('');
let input_key = ref('');
let go_bottom = ref(true);//自动下滑
let drawer = ref(false);
let v_target = null;
let v_input_change = ref('');
let v_id = null;
let v_sid = null;
let v_uid = 0;
const isMobile = ref(false);
const isCollapse = ref(true);
let ai = null;
let submit = null;
const historys = ref([]);

let options = ref([
  {
    value: 'gemini-2.0-flash-exp',
    label: 'Gemini 2.0 Flash',
  },
  {
    value: 'gemini-2.0-flash-thinking-exp-01-21',
    label: 'Gemini 2.0 Flash Thinking',
  },
  {
    value: 'gemini-exp-1206',
    label: 'Gemini 1206',
  },
  {
    value: "deepseek-r1:14b",
    label: "ollama-deepseek-r1:14b-4k",
  },
  {
    value: "deepseek-r1:7b",
    label: "ollama-deepseek-r1:7b-44k",
  },
  {
    value: "deepseek-reasoner",
    label: "DeepSeek R1",
  },
  {
    value: "deepseek-chat",
    label: "DeepSeek V3",
  },
]);
let mtype = {
  "gemini-2.0-flash-exp": model_type.gemini,
  "gemini-2.0-flash-thinking-exp-01-21": model_type.gemini,
  "gemini-exp-1206": model_type.gemini,
  "deepseek-r1:14b": model_type.local,
  "deepseek-r1:7b": model_type.local,
  "deepseek-reasoner": model_type.deepseek,
  "deepseek-chat": model_type.deepseek,
};
let select_model = ref(options.value[0].value);
const text_type = ["&thinsp;&thinsp;User&thinsp;&thinsp;", "&thinsp;&thinsp;Model&thinsp;&thinsp;"];
window.global_msg = global_msg;//DEL
window.ls = ls;//DEL
//----------------------------------------------------------------
if (r_p = ls.read("params")) v_params = ref(r_p);
else v_params = ref([0.9, 0.95, 16, 0]);
try {
  if (r_p = ls.read("keys")) {
    v_keys = ref(r_p);
    input_key.value = v_keys.value[0];
    for (let i = 1; i < v_keys.value.length; i++)input_key.value += `\n${v_keys.value[i]}`;
  }
  else showWarning("请设置密钥.");
  try {
    historys.value = ls.read("save-historys");
    if (!historys.value) historys.value = [];
  } catch (e) {
    showError("加载历史发生错误!");
    console.log(e);
    ls.clear();
  }
} catch (e) {
  ls.save("keys", null);
  console.log(e);
  showError(e);
};

function push_item(obj) {
  global_msg.push(obj);
  document.getElementById("el-msg-box").appendChild(obj);
}
function pop_item() {
  document.getElementById("el-msg-box").removeChild(global_msg.pop());
}
function allocate_id() {
  return `gt-box${global_msg.length}`;
}
function unescapeHTML(a) {
  return a.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
};
function createElement(class_type) {
  const newelm = document.createElement('div');
  newelm.classList.add(class_type);
  return newelm;
}
function showEdit(obj) {
  try {
    if (b_lock.value) return;
    v_target = obj.srcElement.parentNode;
    v_input_change.value = v_target.childNodes[1].textContent;
    v_sid = v_target.childNodes[1].id;
    v_id = parseInt(v_sid.substring(6));
    drawer.value = true;
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
function changeTarget(type) {//1类型,2删除,3文本
  if (!ai) {
    showError("未初始化.");
    return;
  }
  try {
    switch (type) {
      case 1:
        ai.history[v_id].role = (ai.history[v_id].role == "user" ? "model" : "user");
        break;
      case 2:
        ai.history.splice(v_id + 1);
        for (let i = global_msg.length - 1; i > v_id; --i)pop_item();
        break;
      case 3:
        ai.history[v_id].parts[0].text = v_input_change.value;
        break;
    }
  } catch (e) {
    console.log(e);
    showError(e);
  }
  b_lock.value = false;
}
// function changeTextType() {//TODO:bug fix->修改后会重新生成会报错
//   try {
//     b_lock.value = true;
//     if (v_target) {
//       if (!v_id) {
//         showWarning("首条类型不能为Model,必须是User.");
//         b_lock.value = false;
//         return;
//       }
//       v_target.childNodes[0].innerHTML = (v_target.childNodes[0].textContent[2] == "U" ? text_type[1] : text_type[0]);
//       if (v_target.childNodes[0].textContent[2] == "U") {
//         v_target.childNodes[0].style.backgroundColor = "rgb(88, 131, 88)";
//       } else {
//         v_target.childNodes[0].style.backgroundColor = "rgb(87, 104, 120)";
//       }
//       changeTarget(1);
//       showSuccess("设置成功.");
//     } else {
//       throw new Error("设置失败.");
//     }
//   } catch (e) {
//     console.log(e);
//     showError(e);
//   }
//   b_lock.value = false;
// }
function deleteText() {
  try {
    b_lock.value = true;
    if (global_msg.length == 1) {
      clear();
      b_lock.value = false;
      return;
    }
    if (v_target) {
      changeTarget(2);
      showSuccess("调整成功.");
    } else {
      throw new Error("调整失败.");
    }
  } catch (e) {
    console.log(e);
    showError(e);
  }
  b_lock.value = false;
}
function applyTextChange() {
  try {
    b_lock.value = true;
    v_target.childNodes[1].innerText = v_input_change.value;
    changeTarget(3);
    showInfo("更改成功!");
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
function createTextBox(type) {
  try {
    let elm = createElement("scrollbar-item");
    elm.id = allocate_id();
    elm.classList.add("gt-normal");
    let icon = createElement("text-icon");
    icon.innerHTML = type;
    icon.onclick = showEdit;
    if (type == text_type[0]) icon.style.backgroundColor = "rgb(88, 131, 88)";
    else if (type = text_type[1]) icon.style.backgroundColor = "rgb(87, 104, 120)";
    let box = createElement("gt-box");
    box.appendChild(icon);
    box.appendChild(elm);
    return box;
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
function changeModel() {
  if (ai) {
    // if (select_model.value.indexOf("deepseek") != -1) {
    //   if (window.location.href.indexOf("localhost") != -1 && window.location.href.indexOf("127.0.0.1") != -1) {
    //     showWarning("当前模型不可使用.");
    //     return;
    //   }
    // }
    ai.setModel(select_model.value, mtype[select_model.value]);
  }
}
function gotoBottom() {
  try {
    if (go_bottom.value) el_box.value.setScrollTop(el_box.value.wrapRef.scrollHeight + 128);
  } catch (e) {
  }
}
function paramChange() {
  try {
    ls.save("params", v_params.value);
    ai.setParameters(v_params.value[0], v_params.value[1], v_params.value[2]);
    ai.setLimit(v_params.value[3]);
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
function keysChange() {
  try {
    let key = input_key.value;
    let keys = key.split('\n');
    if (v_keys) v_keys.value = keys;
    else v_keys = ref(keys);
    ls.save("keys", keys);
    key_init(v_keys);
    showSuccess("密钥更改成功!");
    setSysMsg();
  } catch (e) {
    showWarning(e);
  }
}
async function sleep(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}
async function changeCollapse() {
  if (isMobile) {
    if (isCollapse.value) {//open
      b_mlock.value = !b_mlock.value;
      await sleep(50);
      isCollapse.value = !isCollapse.value;
    } else {//close
      isCollapse.value = !isCollapse.value;
      await sleep(400);
      b_mlock.value = !b_mlock.value;
    }
  } else {
    isCollapse.value = !isCollapse.value;
  }
}
function key_init(vkey) {
  if (!vkey) return;
  try {
    ai = new GenAI(select_model.value, mtype[select_model.value], vkey.value);
    ai.setParameters(v_params.value[0], v_params.value[1], v_params.value[2]);
    ai.setLimit(v_params.value[3]);
    ai.setCallBack(gotoBottom);
    window.ai = ai;//DEL
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
function setSysMsg() {
  if (!ai) return;
  ai.setSystemMessage(v_sysmsg.value);
}
onMounted(() => {
  isMobile.value = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent || navigator.vendor || window.opera);
  key_init(v_keys);
  submit = function () {
    if (!v_keys || !input_key.value) {
      showWarning("请设置密钥.");
      return;
    }
    try {
      gotoBottom();
      if (!input_value.value) {
        //showError("请输入内容.");
        return;
      }
      b_lock.value = true;
      let newelm = createTextBox(text_type[0]);
      newelm.childNodes[1].innerText = input_value.value;
      push_item(newelm);
      let newelm_ai = createTextBox(text_type[1]);
      push_item(newelm_ai);
      let gt = new GenText(newelm_ai.childNodes[1].id);
      gt.setCallBack((o) => {
        let html = marked.parse(o.text_node.innerHTML);
        html = unescapeHTML(html.replace(/^\s*<p>|<\/p>\s*$/g, ''));
        o.text_node.innerHTML = html;
        gotoBottom();
        save_msg(false);
        b_lock.value = false;
      });
      ai.setProxy(gt);
      ai.postMessage(input_value.value);
      input_value.value = "";
    } catch (e) {
      console.log(e);
      showError(e);
    }
  }
  document.addEventListener("keydown", function (e) {
    if (e.key == "Enter" && !b_lock.value) if (e.ctrlKey) {
      try {
        submit();
      } catch (e) {
        console.log(e);
        showError(e);
      }
    }
  });
});
function clear(test = false) {
  if (!v_keys || !input_key.value) {
    showWarning("请设置密钥.");
    return;
  }
  try {
    b_lock.value = true;
    ai.clear();
    document.getElementById("el-msg-box").replaceChildren();
    global_msg = [];
    b_lock.value = false;
    if (!test) {
      showInfo("已清空消息.");
      is_clear = true;
    }
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
async function resend() {
  try {
    if (!v_keys || !input_key.value) {
      showWarning("请设置密钥.");
      return;
    }
    if (!ai.history.length) {
      showWarning("消息不存在.");
      return;
    }
    if (!ai._proxy) {//TODO:bug fix
      showWarning("请至少新发送一条消息.");
      return;
    }
    b_lock.value = true;
    gotoBottom();
    let to_set = null;
    let first_user = false;
    if (ai.history[ai.history.length - 1].role == "user") {
      let newelm_ai = createTextBox(text_type[1]);
      push_item(newelm_ai);
      let gt = new GenText(newelm_ai.childNodes[1].id);
      to_set = gt;
      first_user = true;
      ai.setInput(ai.history[ai.history.length - 1].parts[0].text);
    } else {
      let last = global_msg[global_msg.length - 1];
      let gt = new GenText(last.childNodes[1].id, 20, false);
      gt.text_node = last.childNodes[1].childNodes[0];
      gt.line = last.childNodes[1].childNodes[1];
      gt.line.hidden = true;
      to_set = gt;
      ai.setInput(ai.history[ai.history.length - 2].parts[0].text);
    }
    ai.setProxy(to_set);
    to_set.setCallBack((o) => {
      let html = marked.parse(o.text_node.innerHTML);
      html = unescapeHTML(html.replace(/^\s*<p>|<\/p>\s*$/g, ''));
      o.text_node.innerHTML = html;
      gotoBottom();
      save_msg(false);
      b_lock.value = false;
    });
    ai._proxy.text_node.innerHTML = "";
    ai.reSubmit(null, first_user);
  } catch (e) {
    console.log(e);
    showError("请至少发送一条消息.");
  };
}
//----------------------------------------------------------------
//存档
function generateID() {
  return Date.now();
}
function getSaveName(id) {
  return `save-${id}`;
}
function packMessage(to_id, is_save) {
  try {
    if (!is_save) {
      if (v_uid) to_id = v_uid;
      else v_uid = to_id;
    } else {
      v_uid = 0;
    }
    let save_data = { sys_prompt: "", dialog: [], id: to_id };
    save_data.sys_prompt = v_sysmsg.value;
    save_data.dialog = ai.history;
    console.log(ai.history);
    ls.save(getSaveName(to_id), save_data);
    for (let i = 0; i < historys.value.length; i++) {
      if (historys.value[i].id == to_id) return;
    }
    historys.value.push({ id: to_id, name: "new" });
    ls.save("save-historys", historys.value);
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
function unpackMessage(pak) {
  try {
    b_lock.value = true;
    clear(true);
    v_sysmsg.value = pak.sys_prompt;
    ai.history = pak.dialog;
    v_uid = pak.id;
    ai.setSystemMessage(v_sysmsg.value);
    for (let i = 0; i < ai.history.length; ++i) {
      let refv = ai.history[i];
      let item = createTextBox(refv.role == "user" ? text_type[0] : text_type[1]);
      let html = marked.parse(refv.parts[0].text);
      html = unescapeHTML(html.replace(/^\s*<p>|<\/p>\s*$/g, ''));
      item.childNodes[1].innerHTML = html;
      push_item(item);
    }
    b_lock.value = false;
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
function save_msg(cdt = true) {
  b_lock.value = true;
  try {
    packMessage(generateID(), cdt);
  } catch (e) {
    console.log(e);
    showError(e);
  }
  b_lock.value = false;
  if (cdt) showSuccess("保存成功!");
}
async function loadHistory(t) {
  if (!ai) {
    showWarning("请先设置密钥.");
    return;
  }
  b_lock.value = true;
  let name = "Unknown";
  let id = 0;
  try {
    let target = t.target.parentNode.parentNode.parentNode.parentNode;
    id = parseInt(target.childNodes[0].innerText);
    name = target.childNodes[1].innerText;
    let pak = ls.read(getSaveName(id));
    if (!pak) {
      showError("此存档不存在!");
      return;
    }
    unpackMessage(pak);
    input_value.value = "";
    v_target = null;
    v_id = null;
    v_sid = null;
    showSuccess(`成功加载<${name}>!`);
    b_lock.value = false;
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
function editName(t) {
  let target = t.target.parentNode.parentNode.parentNode.parentNode;
  let id = parseInt(target.childNodes[0].innerText);
  let value = prompt("请输入新名称:", "default");
  if (value) {
    target.childNodes[1].innerText = value;
  } else return;
  for (let i = 0; i < historys.value.length; i++) {
    if (historys.value[i].id == id) {
      historys.value[i].name = value;
      break;
    }
  }
  ls.save("save-historys", historys.value);
  showSuccess(`更改成功<${value}>!`);
}
function deleteHistory(t) {
  try {
    let target = t.target.parentNode.parentNode.parentNode.parentNode;
    let id = parseInt(target.childNodes[0].innerText);
    ls.remove(getSaveName(id));
    for (let i = 0; i < historys.value.length; ++i) {
      if (historys.value[i].id == id) {
        historys.value.splice(i, 1);
        break;
      }
    }
    ls.save("save-historys", historys.value);
    showSuccess("已删除.");
  } catch (e) {
    console.log(e);
    showError(e);
  }
}
</script>
<template>
  <main>
    <el-drawer v-model="drawer" title="消息设置" :with-header="false" size="70%">
      <span id="edit-area">
        <div class="params-input">
          <!-- <el-button style="width: 100%;" @click="changeTextType()" :disabled="true">改变消息类型</el-button>
          <br> -->
          <el-button style="width: 100%;" @click="deleteText()">调整消息长度</el-button>
          <br>
          <br>
          <el-input v-model="v_input_change" style="width: 100%;" :rows="20" type="textarea" @change="applyTextChange()"
            placeholder="此处设置段落文本" />
        </div>
      </span>
    </el-drawer>
    <span id="chat-list">
      <div class="common-layout">
        <el-container id="chat_container" style="background-color:rgb(30, 30, 30);height: 100%;">
          <el-aside style="background-color: rgb(25,25,25);width: fit-content;" v-if="!isMobile || b_mlock">
            <el-menu default-active="2" class="el-menu-vertical" :collapse="isCollapse">
              <el-sub-menu index="1">
                <template #title>配置</template>
                <el-menu-item-group>
                  <template #title><span>模型设置</span></template>
                  <span>
                    <div class="params-input">
                      <el-input-number v-model="v_params[1]" :min="0.1" :max="1" @change="paramChange()" :step="0.1"
                        :precision="1" size="small"><template #prefix>
                          <span>Top-P</span>
                        </template></el-input-number>
                    </div>
                    <div class="params-input">
                      <el-input-number v-model="v_params[2]" :min="1" @change="paramChange()" size="small"><template
                          #prefix>
                          <span>Top-K</span>
                        </template></el-input-number>
                    </div>
                    <div class="params-input">
                      <el-input-number v-model="v_params[0]" :min="0.1" :max="2" @change="paramChange()" size="small"
                        :step="0.1" :precision="1"><template #prefix>
                          <span>温度</span>
                        </template></el-input-number>
                    </div>
                    <div class="params-input">
                      <el-input-number v-model="v_params[3]" :min="0" @change="paramChange()" size="small"><template
                          #prefix>
                          <span>限制</span>
                        </template></el-input-number>
                    </div>
                    <br>
                    <div class="params-input">
                      <el-input v-model="input_key" style="width: 240px;" :rows="3" type="textarea"
                        @change="keysChange()" placeholder="请输入密钥,多个密钥行间隔" />
                    </div>
                    <br>
                  </span>
                </el-menu-item-group>
              </el-sub-menu>
              <el-sub-menu index="2">
                <template #title>系统</template>
                <el-menu-item-group>
                  <template #title><span>系统提示词</span></template>
                  <div class="params-input">
                    <el-input v-model="v_sysmsg" style="width: 240px" :rows="3" type="textarea" @change="setSysMsg()"
                      placeholder="系统提示词,用于指导模型行为." />
                  </div>
                  <br>
                </el-menu-item-group>
              </el-sub-menu>
              <el-sub-menu index="3">
                <template #title>历史</template>
                <el-table :data="historys" style="width: 100%">
                  <el-table-column fixed prop="id" label="ID" width="100" />
                  <el-table-column prop="name" label="名称" width="100" />
                  <el-table-column fixed="right" label="操作" min-width="100">
                    <template #default>
                      <el-button link type="primary" size="default" @click="editName">重命名</el-button>
                      <el-button link type="primary" size="default" @click="loadHistory">加载</el-button>
                      <el-button link type="primary" size="small" @click="deleteHistory">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-sub-menu>
            </el-menu>
          </el-aside>
          <el-container>
            <el-header height="5%" style="font-size: large;" class="el-header-type1">
              <el-button id="setting" style="width: 3%;" @click="changeCollapse()">⚙️</el-button>
              <el-button id="save" style="width: 3%;" :disabled="b_lock || b_mlock" v-if="!b_mlock"
                v-on:click="save_msg">💾</el-button>
              <span :style="{ opacity: isCollapse ? 1 : 0 }">
                <el-select v-model="select_model" placeholder="Select"
                  style="position: absolute;right: 5%; width: 200px" v-on:change="changeModel()" :disabled="b_mlock"
                  v-if="!b_mlock">
                  <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </span>
            </el-header>
            <el-main style="background-color: rgb(37,37,37);">
              <el-scrollbar ref="el_box" id="el-msg-box"
                :style="{ opacity: isCollapse ? 1 : (isMobile ? 0 : 0.5) }"></el-scrollbar>
            </el-main>
            <el-footer height="100px" style="position:relative;top: 10px;height: 20%;">
              <span style="display: flex;" :style="{ opacity: isCollapse ? 1 : 0 }">
                <el-input v-model="input_value" type="textarea" placeholder="请输入内容"
                  style="position:relative;top: 0px;width: 85%;" :autosize="{ minRows: 2, maxRows: 4 }"
                  v-if="!b_mlock"></el-input>
                <span style="width: 10%;">
                  <el-button id="send" style="position:relative; width: 5%;left:12px; font-size: 140%;"
                    :disabled="b_lock || b_mlock" v-on:click="submit">✦</el-button>
                  <el-button id="resend" style="width: 5%;font-size: 140%;" :disabled="b_lock || b_mlock"
                    v-if="!b_mlock" v-on:click="resend">⟳</el-button>
                  <el-button id="clear" style="width: 5%;font-size: 140%;" :disabled="b_lock || b_mlock" v-if="!b_mlock"
                    v-on:click="clear">🧹</el-button>
                </span>
              </span>
            </el-footer>
          </el-container>
        </el-container>
      </div>
    </span>
  </main>
</template>
<style>
.el-header-type1 {
  align-items: center;
  margin-top: 10px;
  margin-bottom: 5px;
}

.el-menu-vertical:not(.el-menu--collapse) {
  width: 300px;
  min-width: 0px;
}

.params-input {
  padding-left: 15px;
  padding-right: 15px;
}

.text-icon {
  align-items: center;
  text-align: center;
  justify-content: center;
  width: fit-content;
  border-radius: 10px;
  background-color: rgb(70, 70, 70);
}

.scrollbar-item {
  align-items: center;
  justify-content: left;
  height: fit-content;
  margin: 10px;
  text-align: left;
  border-radius: 2px;
  padding-left: 5px;
}

.common-layout {
  position: fixed;
  top: 0%;
  left: 0%;
  width: 100%;
  height: 100%;
}

.c-history {
  background-color: rgb(76, 76, 76);
}

.text-icon:hover {
  color: rgb(255, 255, 255);
  transform: translateX(5px);
}

.text-icon {
  transform: translateX(0);
  transition: transform 0.3s ease;
}

think {
  color: lightgreen;
}
</style>
