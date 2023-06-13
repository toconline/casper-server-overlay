import { LitElement, html, css } from 'lit';

import '@cloudware-casper/casper-icons/loading_components/loading-icon-01.js';
import '@cloudware-casper/casper-icons/loading_components/loading-icon-02.js';
import '@cloudware-casper/casper-icons/loading_components/loading-icon-03.js';
import '@cloudware-casper/casper-icons/loading_components/loading-icon-04.js';
import '@cloudware-casper/casper-icons/loading_components/loading-icon-05.js';


class CasperServerOverlayLit extends LitElement {
  static properties = {
    socket: {
      type: Object
    },
    description: {
      type: String
    },
    noCancelOnEscKey: {
      type: Boolean
    },
    noCancelOnOutsideClick: {
      type: Boolean
    },
    defaultOpacity: {
      type: Number
    }
  };

  static styles = css`
    .server-overlay {
      border: none;
      padding: 0;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 80vw;
      max-height: 70vh;
      background-color: transparent;
      fill: #FFF;
    }

    .server-overlay[open] {
      display: flex;
    }

    .server-overlay::backdrop {
      background-color: rgba(204, 204, 204, 65%);
    }

    .server-overlay__status {
      position: relative;
      width: 200px;
      height: 200px;
    }

    svg {
      position: absolute;
      top: 50px;
      left: 50px;
    }

    .server-overlay__image {
      position: absolute;
      width: 200px;
      height: 200px;
      top: 0;
      left: 0;
    }

    .server-overlay__description {
      text-align: center;
      color: #D8D8D8;
      font-size: 1.5rem;
      line-height: 1.5em;
    }
  `;

  
  constructor () {
    super();

    this.description = 'Teste';

    this.noCancelOnEscKey = true;
    this.noCancelOnOutsideClick = false;
    this.defaultOpacity = 0.7;

    this._visibilityTimer = undefined;
    this._disconnected = false;
    this._debounceTimeout = 1;
    this._debounceTimerId = undefined;
    this._connecting = false;

    this._boundOnCasperShowOverlay = this._onCasperShowOverlay.bind(this);
    this._boundOnHideOverlay = this._onHideOverlay.bind(this);
    this._boundOnCasperSignedIn = this._onCasperSignedIn.bind(this);
    this._boundOnCasperDisconnected = this._onCasperDisconnected.bind(this);
    this._boundCloseByUser = this._onCloseByUser.bind(this);
  }

  connectedCallback () {
    super.connectedCallback();

    this.addEventListener('mousemove', this._moveHandler);
    this.addEventListener('mouseup', this._mouseUpHandler);
    
    window.addEventListener('casper-show-overlay', this._boundOnCasperShowOverlay);
    window.addEventListener('casper-dismiss-overlay', this._boundOnHideOverlay);
    window.addEventListener('casper-signed-in', this._boundOnCasperSignedIn);
    window.addEventListener('casper-disconnected', this._boundOnCasperDisconnected);
    document.addEventListener('keydown', this._boundCloseByUser);

    this._opacity = this.defaultOpacity;
    this.style.opacity = this._opacity;
  }

  disconnectedCallback () {
    super.disconnectedCallback();

    if (this._visibilityTimer) {
      clearTimeout(this._visibilityTimer);
      this._visibilityTimer = undefined;
    }

    window.removeEventListener('casper-show-overlay', this._boundOnCasperShowOverlay);
    window.removeEventListener('casper-dismiss-overlay', this._boundOnHideOverlay);
    window.removeEventListener('casper-signed-in', this._boundOnCasperSignedIn);
    window.removeEventListener('casper-disconnected', this._boundOnCasperDisconnected);
    document.removeEventListener('keydown', this._boundCloseByUser);
  }


  //***************************************************************************************//
  //                               ~~~ Lit lifecycle  ~~~                                  //
  //***************************************************************************************//
  
  render () {
    return html`
      <dialog id="overlay" class="server-overlay">
        <div class="server-overlay__status">
          <img id="image" class="server-overlay__image" alt=${this.description}>
          <!-- spinner placeholder -->
          <div id="spinner" class="server-overlay__spinner">&nbsp;</div>
        </div>
        <p class="server-overlay__description">${this.description}</p>
      </dialog>
    `;
  }

  firstUpdated () {
    this._serverOverlayEl = this.shadowRoot.querySelector('#overlay');
    this._imageEl = this.shadowRoot.querySelector('#image');
    this._spinnerEl = this.shadowRoot.querySelector('#spinner');

    this._serverOverlayEl.addEventListener('cancel', this._cancelHandler.bind(this));
  }



  //***************************************************************************************//
  //                              ~~~ Public methods  ~~~                                  //
  //***************************************************************************************//

  open () {
    this._serverOverlayEl.showModal();
  }

  close () {
    this._serverOverlayEl.close();
  }


  
  //***************************************************************************************//
  //                              ~~~ Private methods  ~~~                                 //
  //***************************************************************************************//

  _onHideOverlay (event) {
    //console.log("--- Hide overlay", this.noCancelOnOutsideClick);

    this.style.opacity = 0.0;
    if (this._visibilityTimer) {
      clearTimeout(this._visibilityTimer);
      this._visibilityTimer = undefined;
    }

    if (this._debounceTimerId) {
      clearTimeout(this._debounceTimerId);
      this._debounceTimerId = undefined;
    }

    this._connecting = false;
    this.close();
  }

  _onCasperSignedIn (event) {
    this._onHideOverlay();
    this._debounceTimeout = 1;
    this._disconnected = false;
    this._connecting = false;
    this.opacity = this.defaultOpacity;
  }

  _onCasperDisconnected (event) {
    this._disconnected = true;
    this._connecting = false;
    if (!event.detail.silent) this._onCasperShowOverlay(event);
  }

  _onCasperShowOverlay (event) {
    //console.log("+++ show overlay: ", event.detail);

    this.disconnected = false;
    this._opacity = event.detail.opacity ? event.detail.opacity : this.defaultOpacity;

    if ((event.detail).hasOwnProperty('message')) {
      this.description = event.detail.message;
    }

    if (event.detail.spinner === true) {
      this._spinnerEl.style.display = 'block';
      const loadingElement = document.createElement((event.detail.loading_icon != undefined ? event.detail.loading_icon : 'loading-icon-01'));
      const beforeElement = this._spinnerEl.childNodes[0];
      this._spinnerEl.replaceChild(loadingElement, beforeElement);
    } else {
      this._spinnerEl.style.display = 'none';
    }

    if (event.detail.icon) {
      const icon = event.detail.icon;

      this._imageEl.style.display = '';
      this._imageEl.src = icon.indexOf('/') === -1 ? `/node_modules/@cloudware-casper/casper-server-overlay/static/icons/${icon}.svg` : icon;
    } else {
      this._imageEl.src = '';
      this._imageEl.style.display = 'none';
    }

    if (!this.opened) this.open();

    this.noCancelOnOutsideClick = (event.detail).hasOwnProperty('noCancelOnOutsideClick');

    if (this._visibilityTimer) clearTimeout(this._visibilityTimer);
    this._visibilityTimer = setTimeout((e) => this._changeOpacity(e), 100);
  }

  _changeOpacity () {
    this.style.opacity = this._opacity;
    this._opacity = this.defaultOpacity;
  }

  _moveHandler (event) {
    if (this.opened === true) {
      this._reconnect();
    }
  }

  _mouseUpHandler (event) {
    if (this.opened === true) {
      this._reconnect();
      this._onCloseByUser();
    }
  }

  // Fired when user presses the 'esc' key
  _cancelHandler (event) {
    if (!event) return;

    // Needed otherwise it would call the dialog's native close method
    event.preventDefault();

    if (this.noCancelOnEscKey) return;
    this.close();
  }

  _onCloseByUser (event) {
    if (this.opened && !this._connecting) {
      if (event?.detail?.reload) {
        window.location.reload();
      } else {
        if (!this.noCancelOnOutsideClick) {
          this._onHideOverlay();
        }
      }
    }
  }

  _reconnect () {
    if (this._disconnected && !this._connecting && this._debounceTimerId === undefined) {
      this._debounceTimerId = setTimeout(e => this._debounceTimerExpired(e), this._debounceTimeout * 1000);

      this._connecting = true;
      this._disconnected = false;
      
      this.socket.checkIfSessionChanged();
      this.socket.validateSession();
    }
  }

  _debounceTimerExpired (event) {
    this._debounceTimeout = Math.min(this._debounceTimeout * 2, 10);
    this._debounceTimerId = undefined;
  }
}

customElements.define('casper-server-overlay-lit', CasperServerOverlayLit);