const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

function hasConfigOrEntityChanged(element, changedProps) {
  if (changedProps.has("config")) {
    return true;
  }

  const oldHass = changedProps.get("hass");
  if (oldHass) {
    return (
      oldHass.states[element.config.entity] !== element.hass.states[element.config.entity]
    );
  }

  return true;
}

class xiaomiMiotCard extends LitElement {
  static get properties() {
    return {
      config: {},
      hass: {},
      btns: {}
    };
  }
  
  model = {};
  mappath = '/local/community/';

  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to define entity");
    }
    this.config = config;
  }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback()
    const state = this.hass.states[this.config.entity];
    console.log('model:', state.attributes.model);
    this.model = this.config.model ? this.config.model : state.attributes.model;
    this.mappath = this.config.mappath ? this.config.mappath : this.mappath;
    this.btns = this._resolveData();
  }

  async _resolveData() {
    const response = await this.loadJSON(`${this.mappath}/lovelace-xiaomi-miot/map_${this.model}.json`);
    return response;
  }
  async loadJSON(url) {
      try {
          const response = await fetch(url);
          this.btns = await response.json();
          // return this.btns;
          // console.log(this.btns);
      } catch (err) {
          console.log(err);
      }
  }




  shouldUpdate(changedProps) {
    return hasConfigOrEntityChanged(this, changedProps);
  }

  render() {
    // console.log('render model:', this.model);
    const state = this.hass.states[this.config.entity];
    const stateStr = state ? state.state : 'unavailable';
    const deviceType = this.model.split('.')[1];
    const cardcss = (typeof this.btns.card?.css == 'string') ? this.btns.card.css : "";
    if (stateStr == 'unavailable') {
      return html`<div class="not-found">Entity ${this.config.entity} not found.</div>`;
    } else {
      const hideTitle = this.config?.hide_title ? 'hide' : '';
      return html`
        <ha-card class="${deviceType} ${this.model.replace(/\./g,'_')} state_${stateStr}" style="${cardcss}">
          <div class="title ${hideTitle}">
            ${state.attributes.friendly_name}
          </div>

          ${Object.entries(this.btns).map(([key,btn]) => {
            btn.name = key;
            return this.setUi(state, btn);
          })}

        </ha-card>
      `;
    }
  }


  setUi(state, btn) {
    if (btn.name == 'card') {
      return;
    } else if (btn.name == 'slider') {
      return this.setSpeedSlider(state, btn);
    } else {
      if (btn.name == 'down' || btn.name == 'up') {
        if (this.config.percentage_step) {
          btn.step = this.config.percentage_step;
        }
      } else if (btn.name == 'off_delay_time') {
        if (this.config.off_delay_time) {
          btn.value = this.config.off_delay_time;
        }
      } else if (btn.name == 'swing_left' || btn.name == 'swing_right') {
        btn.prop.data.entity_id = this.config.entity.replace(/^fan\./i, 'select.').replace(/_fan$/i, '_horizontal_angle');
      }
      return this.setBtn(state, btn);
    }
  }

  setBtn(state, btn) {
    if (btn.hide == true) {
      return;
    }
    let box = document.createElement('div');
    box.className = btn.name;
    let bg = false;
    if (bg = this.setBgcolor(state, btn)) {
      box.style.backgroundColor = bg;
    }
    box.innerHTML = `
      <span class="icon-waper">
        <ha-icon icon="${this.setIcon(state, btn)}"></ha-icon>
      </span>
      <span class="state">${this.setState(state, btn)}</span>
      <span class="label">${this.setLabel(state, btn)}</span>
    `;
    // box.ondblclick = () => {
    //   this._toggle('dblclick', state, btn);
    // }
    box.addEventListener("click", () => {
      this._toggle('click', state, btn);
    });
    if (typeof btn.value == 'boolean') {
      if (state.attributes[btn.prop]) {
        box.classList.add('active');
      }
    }
    if (btn.name == 'off_delay_time') {
      if (state.attributes['off_delay_time'] != undefined) {
        box.classList.add((state.attributes['off_delay_time'] != 0) ? 'active' : 'inactive');
      } else if (state.attributes['countdown.countdown_time'] != undefined) {
        box.classList.add((state.attributes['countdown.countdown_time'] != 0) ? 'active' : 'inactive');
      }
    } else if (btn.name == 'mode') {
      box.classList.add((state.attributes['fan.mode'] !== btn.state.indexOf('Straight Wind')) ? 'active' : 'inactive');
    } else if (btn.name == 'hswing_angle') {
      box.classList.add((state.attributes['fan.horizontal_swing']) ? 'show' : 'hide');
    } else if (btn.name == 'vswing_angle') {
      box.classList.add((state.attributes['fan.vertical_swing']) ? 'show' : 'hide');
    } else if (btn.name == 'swing_left' || btn.name == 'swing_right') {
      box.classList.add((state.attributes['fan.horizontal_swing']) ? 'hide' : 'show');
    } else if (btn.name == 'swing_up' || btn.name == 'swing_down') {
      box.classList.add((state.attributes['fan.vertical_swing']) ? 'hide' : 'show');
    }
    return box;
  }

  setSpeedSlider(state, btn) {
    const box = document.createElement('div');
    box.className = btn.name;
    const min = btn.min ?? 1;
    const max = btn.max ?? 100;
    const step = btn.step ?? 1;
    const val = this.setState(state, btn);
    box.innerHTML = `
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}">
    `;
    const inp = box.querySelector("input[type=range]");
    
    inp.addEventListener("change", () => {
      // alert(this.value);
      // console.log('slider set value: ',inp.value);
      this._toggle('click', state, btn, Number(inp.value));
    });
    return box;
  }

  setIcon(state, btn) {
    let i, attr = state.attributes[btn.prop]
    if (typeof btn.icon == 'string') {
      return btn.icon;
    } else if (typeof btn.value == 'boolean') {
      i = state.attributes[btn.prop] ? 1 : 0;
    } else if (typeof btn.icon == 'object') {
      i = btn.value.indexOf(state.attributes[btn.prop]);
    }
    return btn.icon[i];
  }
  setState(state, btn) {
    let i;
    if (typeof btn.state == 'undefined') {
      return state.attributes[btn.prop];
    } else if (typeof btn.value == 'boolean') {
      i = state.attributes[btn.prop] ? 1 : 0;
    } else if (typeof btn.state == 'object') {
      i = btn.value.indexOf(state.attributes[btn.prop]);
    } else {
      return state.attributes[btn.prop];
    }
    return btn.state[i];
  }
  setBgcolor(state, btn) {
    let i;
    if (typeof btn.bgcolor == 'undefined') {
      return false;
    } else if (typeof btn.bgcolor == 'string') {
        return btn.bgcolor;
    } else if (typeof btn.value == 'boolean') {
      i = state.attributes[btn.prop] ? 1 : 0;
    } else if (typeof btn.state == 'object') {
      i = btn.value.indexOf(state.attributes[btn.prop]);
    }
    return btn.bgcolor[i];
  }
  setLabel(state, btn) {
    if (typeof btn.label == 'undefined') {
      return '';
    }
    if (typeof this.btns[btn.label] == 'undefined') {
      return state.attributes[btn.label];
    } else {
      btn = this.btns[btn['label']];
      return this.setState(state, btn);
    }
  }
  _toggle(type, state, btn, value) {
    // if (state.state == 'off' && btn.name != 'power') {
    //   return;
    // }
    if (btn[type] == '') {
      return;
    }
    if (typeof btn[type] != 'undefined') {
      btn = this.btns[btn[type]];
    }

    let _field = btn.prop;
    let _value = '';
    if (typeof value != 'undefined') {
      _value = value;
    } else if (typeof btn.value == 'boolean') {
      _value = !state.attributes[btn.prop];
    } else if (typeof btn.value == 'number') {
      if (typeof btn.step == 'undefined' || btn.step == 0) {
        _value = btn.value;
      } else {
        _value = state.attributes[btn.prop];
        _value += (btn.backward == true) ? -btn.step : btn.step;
        if (_value > btn.max ) {
          _value = btn.max;
        } else if(_value < btn.min) {
          _value = btn.min;
        }
      }
    } else if (typeof btn.value == 'object') {
      let i = btn.value.indexOf(state.attributes[btn.prop]);
      i += (btn.backward == true) ? -1 : 1;
      if (btn.value.length <= i) {
        i = 0;
      } else if (i < 0) {
        i = btn.value.length - 1
      }
      _value = btn.value[i];
    } else {
      _value = btn.value;
    }
    // console.log(type, btn.name, _field, _value, typeof _value);
    if (typeof btn.prop == 'object') {
      if (typeof btn.prop.service != 'undefined') {
        this.hass.callService(btn.prop.service, btn.prop.service_value, btn.prop.data);
      } else {
        this.hass.callService('xiaomi_miot', "set_miot_property", {
          entity_id: state.entity_id,
          siid: btn.prop.siid,
          piid: btn.prop.piid,
          value: _value
        });
      }
    } else {
      this.hass.callService('xiaomi_miot', "set_property", {
        entity_id: state.entity_id,
        field: _field,
        value: _value
      });
    }

    // 속도 조절시 전원이 꺼져있으면 켜기
    if (btn.name == 'slider' && state.attributes[this.btns.power.prop] == false) {
      this._toggle('click', state, this.btns.power, true);
    }
  }

  // The height of your card. Home Assistant uses this to automatically
  // distribute all cards over the available columns.
  getCardSize() {
    return 1;
  }


  static get styles() {
    return css`
      :host {
      }
      @keyframes rotate_image{
        100% {
            transform: rotate(360deg);
        }
      }
      ha-card {
        background: var(--ha-card-background, var(--card-background-color, white) );
        border-radius: var(--ha-card-border-radius, 4px);
        box-shadow: var( --ha-card-box-shadow, 0px 2px 1px -1px rgba(0, 0, 0, 0.2), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px 0px rgba(0, 0, 0, 0.12) );
        color: var(--primary-text-color);
        padding: var(--card-padding, 10px);
        display: grid;
        gap: var(--card-grid-gap, 6px 6px);
        align-items: center;
        place-content: space-between;
      }
      
      ha-card>div {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--box-background-color, var(--secondary-background-color));
        color: var(--secondary-text-color);
        --color: var(--primary-text-color);
        border-radius: 5px;
        border: none;
        width: 100%;
        height: 100%;
        min-height: 40px;
        cursor: pointer;
        transition: all 0.4s;
        position: relative;
      }
      ha-card>div:active,
      ha-card>div.active {
        background: var(--box-active-background-color, var(--primary-color));
        color: var(--box-active-color, var(--text-primary-color));
      }
      ha-card>div.active.fault {
        background: var(--error-color);
        color: white;
      }
      ha-card.state_off>div.active {
        opacity: 0.5;
      }
      ha-card>div:active.slider { 
        background: none !important;
      }
      /*ha-card>div.active::before {
          content: "";
          position: absolute;
          top: 0px;
          right: 0px;
          bottom: 0px;
          left: 0px;
          background-color: var(--paper-item-icon-active-color, #fdd835)
          opacity: 0.6;
      }*/
      ha-card>div.active .icon-waper {
        color: var(--icon-active-color, --primary-text-color);
      }
      ha-card.fan>div.power.active .icon-waper {
        animation: rotate_image 1s linear infinite;
        transform-origin: 50% 50%;
      }
      .title {        grid-area: n; color: var(--primary-text-color) }
      .power {        grid-area: p; }
      .mode {         grid-area: m; }
      .speed {        grid-area: s; }
      .down {         grid-area: s; position: relative; width: 50%; }
      .up {           grid-area: s; position: relative; width: 50%; left: 50%;}
      .slider {       grid-area: n; opacity: 0.5; }
      .off_delay_time { grid-area: o; }
      .hswing {       grid-area: hs; }
      .hswing_angle { grid-area: ha; }
      .swing_left {   grid-area: ha; position: relative; width: 50%; }
      .swing_right {  grid-area: ha; position: relative; width: 50%; left: 50%; }
      .vswing {       grid-area: vs; }
      .vswing_angle { grid-area: va; }
      .swing_down {   grid-area: va; position: relative; width: 50%; }
      .swing_up {     grid-area: va; position: relative; width: 50%; left: 50%; }
      .auto_on {      grid-area: ao; }
      .auto_on_temp_minus {grid-area: aot; position: relative; width: 50%; }
      .auto_on_temp_plus  {grid-area: aot; position: relative; width: 50%; left: 50%; }
      .auto_off {     grid-area: af; }
      .auto_off_temp_minus{grid-area: aft; position: relative; width: 50%; }
      .auto_off_temp_plus {grid-area: aft; position: relative; width: 50%; left: 50%; }
      .temperature  { grid-area: t; cursor: default; }
      .humidity {     grid-area: h; cursor: default; }
      .alarm {        grid-area: a; position: relative; width: 50%; }
      .indicator_light,
      .locked {       grid-area: a; position: relative; width: 50%; left: 50%; }
      .brightness {   grid-area: b; }
      .fan_level {    grid-area: fl; }
      .status {       grid-area: st; cursor: default; }
      .fault {        grid-area: f; cursor: default; }

      .hide,
      .state {
        display: none;
      }
      .hswing_angle .state,
      .vswing_angle .state,
      .auto_on_temp .state,
      .auto_off_temp .state,
      .temperature .state,
      .humidity .state,
      .fan_level .state,
      .off_delay_time.active .state {
        display: inline;
      }
      .power .label:after {
        content: "%";
        font-size: 80%;
      }
      .heater .power .label:after {
        content: "°C";
      }
      .off_delay_time .state:after {
        content: "m";
        font-size: 80%;
      }
      .heater .off_delay_time .state:after {
        content: "h";
      }
      .vswing_angle .state:after,
      .hswing_angle .state:after {
        content: "°";
      }
      .hswing_angle .icon-waper,
      .vswing_angle .icon-waper {
        transform: scale(0.7);
      }
      .not-found {
        background-color: var(--error-color);
        font-family: sans-serif;
        font-size: 14px;
        padding: 8px;
        border-radius: 5px;
        border: none;
        min-height: 40px;
      }


      input[type="range"] { 
        margin: auto;
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        position: relative;
        overflow: hidden;
        height: 100%;
        width: 100%;
        cursor: pointer;
        border-radius: 5px;
      }
      
      input[type="range"]::-webkit-slider-runnable-track {
        --background: #ddd;
      }
      
      /*
      * 1. Set to 0 width and remove border for a slider without a thumb
      * 2. Shadow is negative the full width of the input and has a spread 
      *    of the width of the input.
      */
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 2%; /* 1 */
        height: 100%;
        background: var(--box-active-background-color, var(--primary-color));
        box-shadow: -2000px 0 0 2000px var(--box-active-background-color, var(--primary-color)); /* 2 */
        border: 0; /* 1 */
      }
      
      input[type="range"]::-moz-range-track {
        height: 0;
        --background: #ddd;
      }
      
      input[type="range"]::-moz-range-thumb {
        background: var(--box-active-background-color, var(--primary-color));
        width: 2%; /* 1 */
        height: 100%;
        border: 0;
        border-radius: 0 !important;
        box-shadow: -2000px 0 0 2000px var(--box-active-background-color, var(--primary-color));
        box-sizing: border-box;
      }
      
      input[type="range"]::-ms-fill-lower { 
        background: var(--box-active-background-color, var(--primary-color));
      }
      
      input[type="range"]::-ms-thumb { 
        --background: #fff;
        border: 0;
        width: 2%; /* 1 */
        height: 100%;
        box-sizing: border-box;
      }
      
      input[type="range"]::-ms-ticks-after { 
        display: none; 
      }
      
      input[type="range"]::-ms-ticks-before { 
        display: none; 
      }
      
      input[type="range"]::-ms-track { 
        --background: #ddd;
        color: transparent;
        height: 100%;
        border: none;
      }
      
      input[type="range"]::-ms-tooltip { 
        display: none;
      }
    `;
  }

}
customElements.define("xiaomimiot-card", xiaomiMiotCard);
console.info(`%cXIAOMI-MIOT CARD v1.0.0 IS INSTALLED`,"color: green; font-weight: bold","");