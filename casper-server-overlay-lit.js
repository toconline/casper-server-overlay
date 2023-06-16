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
    },
    _customOpacity: {
      type: Number
    }
  };

  static styles = css`
    .server-overlay {
      outline: none;
      border: none;
      padding: 0;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 80vw;
      max-height: 70vh;
      background-color: transparent;
      fill: #FFF;
      /* The default is display: none, which prevents transitions from working, so its display must always be flex */
      display: flex;
    }

    .server-overlay,
    .server-overlay::backdrop {
      opacity: 0;
      transition: opacity 0.8s ease-in;
    }

    .server-overlay::backdrop {
      background-color: #000;
    }

    :host([visible]) .server-overlay,
    :host([visible]) .server-overlay::backdrop {
      opacity: 0.7;,
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

    this.description = '';
    this.noCancelOnEscKey = true;
    this.noCancelOnOutsideClick = false;
    this.defaultOpacity = 0.7;

    this._customOpacity = undefined;
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
  }

  disconnectedCallback () {
    super.disconnectedCallback();

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
    /* ::backdrop doesn't inherit from other elements and can't be selected via js, which is why we have to set its custom opacity like this */
    const opacityStyle = html`
      <style> 
        :host([visible]) .server-overlay,
        :host([visible]) .server-overlay::backdrop { 
          opacity: ${this._customOpacity} !important;
        } 
      </style>
    `;

    return html`
      ${this._customOpacity !== undefined ? opacityStyle : ''}
    
      <dialog id="overlay" class="server-overlay">
        <div class="server-overlay__status">
          <img id="image" class="server-overlay__image" alt=${this.description}>
          <!-- Spinner placeholder -->
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
    this.setAttribute('visible', '');
  }

  close () {
    if (this._serverOverlayEl.open) this.removeAttribute('visible');

    setTimeout(() => {
      this._serverOverlayEl.close();
    }, 800);
  }


  
  //***************************************************************************************//
  //                              ~~~ Private methods  ~~~                                 //
  //***************************************************************************************//

  _onHideOverlay (event) {
    //console.log("--- Hide overlay", this.noCancelOnOutsideClick);

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
  }

  _onCasperDisconnected (event) {
    this._disconnected = true;
    this._connecting = false;
    if (!event.detail.silent) this._onCasperShowOverlay(event);
  }

  async _onCasperShowOverlay (event) {
    //console.log("+++ show overlay: ", event.detail);

    if (!this._serverOverlayEl) await this.updateComplete;

    if (event.detail.hasOwnProperty('opacity')) this._customOpacity = event.detail.opacity;
    if (event.detail.hasOwnProperty('message')) this.description = event.detail.message;

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

    this.noCancelOnOutsideClick = (event.detail).hasOwnProperty('noCancelOnOutsideClick');
    if (!this._serverOverlayEl.open) this.open();
  }

  _moveHandler (event) {
    if (this._serverOverlayEl?.open) {
      this._reconnect();
    }
  }

  _mouseUpHandler (event) {
    if (this._serverOverlayEl?.open) {
      this._reconnect();
      this._onCloseByUser();
    }
  }

  // Fired when user presses the 'esc' key
  _cancelHandler (event) {
    if (!event) return;

    // Needed otherwise it would call the dialog's native close method
    event.preventDefault();
  }

  _onCloseByUser (event) {
    if (this._serverOverlayEl.open && !this._connecting) {
      if (event?.detail?.reload) {
        window.location.reload();

      } else {
        if (event?.key === 'Escape') {
          if (!this.noCancelOnEscKey) this._onHideOverlay();
        } else {
          if (!this.noCancelOnOutsideClick) this._onHideOverlay();
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