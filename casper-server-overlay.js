/*
  - Copyright (c) 2017 Cloudware S.A. All rights reserved.
  -
  - This file is part of casper-server-overlay.
  -
  - casper-server-overlay is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - casper-server-overlay  is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with casper-server-overlay.  If not, see <http://www.gnu.org/licenses/>.
  -
 */

import { mixinBehaviors } from '@polymer/polymer/lib/legacy/class.js';
import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
import { IronOverlayBehavior } from '@polymer/iron-overlay-behavior/iron-overlay-behavior.js';

class CasperServerOverlay extends mixinBehaviors([IronOverlayBehavior], PolymerElement) {
  static get template() {
    return html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: black;
          width: 100%;
          height: 100vh;
          opacity: 1;
          transition: opacity 3s;
          z-index: 8000;
          fill: white;
        }

        .spinner {
          position: relative;
          width: 200px;
          height: 200px;
        }

        svg {
          position: absolute;
          top: 50px;
          left: 50px;
        }

        #image {
          position: absolute;
          width: 200px;
          height: 200px;
          top: 0;
          left: 0;
        }

        p {
          text-align: center;
          color: #D8D8D8;
          font-size: 1.5em;
          line-height: 1.5em;
        }

      </style>
      <div class="spinner">
        <img id="image" alt="[[description]]">
        <div id="spinner">&nbsp;</div> <!-- spinner placeholder -->
      </div>
      <p>[[description]]</p>
    `;
  }

  static get is () {
    return 'casper-server-overlay';
  }

  static get properties () {
    return {
      socket: Object,
      description: String,
      icon: Object,
      defaultOpacity: {
        type: Number,
        value: 0.7
      }
    };
  }

  ready () {
    super.ready();
    this.noCancelOnEscKey = true;
    this.noCancelOnOutsideClick = false;
    this._visibilityTimer = undefined;
    this._disconnected    = false;
    this._debounceTimeout = 1;
    this._debounceTimerId = undefined;
    this._connecting      = false;

    this._boundOnCasperShowOverlay  = this._onCasperShowOverlay.bind(this);
    this._boundOnHideOverlay        = this._onHideOverlay.bind(this);
    this._boundOnCasperDisconnected = this._onCasperDisconnected.bind(this);
    this._boundOnCasperSignedIn     = this._onCasperSignedIn.bind(this);
    this._boundOnCasperSignedIn     = this._onCasperSignedIn.bind(this);
    this._boundCloseByUser          = this._onCloseByUser.bind(this);

    this.addEventListener('mousemove', this._moveHandler);
    this.addEventListener('mouseup'  , this._mouseUpHandler);
  }

  connectedCallback () {
    super.connectedCallback();
    window.addEventListener('casper-show-overlay'   , this._boundOnCasperShowOverlay);
    window.addEventListener('casper-dismiss-overlay', this._boundOnHideOverlay);
    window.addEventListener('casper-disconnected'   , this._boundOnCasperDisconnected);
    window.addEventListener('casper-signed-in'      , this._boundOnCasperSignedIn);
    document.addEventListener('keydown', this._boundCloseByUser);

    this._opacity = this.defaultOpacity;
    this.style.opacity = this._opacity;
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    if ( this._visibilityTimer ) {
      clearTimeout(this._visibilityTimer);
      this._visibilityTimer = undefined;
    }
    window.removeEventListener('casper-show-overlay'   , this._boundOnCasperShowOverlay);
    window.removeEventListener('casper-dismiss-overlay', this._boundOnHideOverlay);
    window.removeEventListener('casper-disconnected'   , this._boundOnCasperDisconnected);
    window.removeEventListener('casper-signed-in'      , this._boundOnCasperSignedIn);
    document.removeEventListener('keydown', this._boundCloseByUser);
  }

  _onHideOverlay (event) {
    // console.log("--- Hide overlay", this.noCancelOnOutsideClick);
    if (this.noCancelOnOutsideClick === false) {
      this.style.opacity = 0.0;
      if ( this._visibilityTimer ) {
        clearTimeout(this._visibilityTimer);
        this._visibilityTimer = undefined;
      }
      if ( this._debounceTimerId ) {
        clearTimeout(this._debounceTimerId);
        this._debounceTimerId = undefined;
      }
      this._connecting = false;
      this.close();
    }
  }

  _onCasperSignedIn (event) {
    this._onHideOverlay();
    this._debounceTimeout = 1;
    this._disconnected    = false;
    this._connecting      = false;
    this.opacity          = this.defaultOpacity;
  }

  _onCasperDisconnected (event) {
    this._disconnected = true;
    this._connecting = false;
    if ( ! event.detail.silent ) {
      this._onCasperShowOverlay(event);
    }
  }

  _onCasperShowOverlay (event) {
    // console.log("+++ show overlay: ", event.detail);

    this.disconnected = false;
    this._opacity = event.detail.opacity ? event.detail.opacity : this.defaultOpacity;

    if ( (event.detail).hasOwnProperty('message') ) {
      this.description = event.detail.message;
    }
    if ( event.detail.spinner === true ) {
      this.$.spinner.style.display = 'block';
      const loadingElement = document.createElement((event.detail.loading_icon != undefined ? event.detail.loading_icon : 'loading-icon-01'));
      const beforeElement = this.$.spinner.childNodes[0];
      this.$.spinner.replaceChild(loadingElement, beforeElement);
    } else {
      this.$.spinner.style.display = 'none';
    }

    if ( event.detail.icon  ) {
      const icon = event.detail.icon;
      if ( icon.indexOf('/') === -1 ) {
        this.$.image.src = this.resolveUrl(`/node_modules/@casper2020/casper-server-overlay/static/icons/${icon}.svg`);
      } else {
        this.$.image.src = icon;
      }
    } else {
      this.$.image.src = '';
    }

    if (!this.opened) {
      this.open();
    }

    this.noCancelOnOutsideClick = (event.detail).hasOwnProperty('noCancelOnOutsideClick');

    if ( this._visibilityTimer ) {
      clearTimeout(this._visibilityTimer);
    }

    this._visibilityTimer = setTimeout((e) => this._changeOpacity(e), 100);

  }

  _changeOpacity () {
    this.style.opacity = this._opacity;
    this._opacity = this.defaultOpacity;
  }

  _moveHandler (event) {
    if ( this.opened === true ) {
      this._reconnect();
    }
  }

  _mouseUpHandler (event) {
    if ( this.opened === true ) {
      this._reconnect();
      this._onCloseByUser();
    }
  }

  _onCloseByUser (event) {
    if ( this.opened === true && this._connecting === false ) {
      if ( event && event.detail && event.detail.reload ) {
        window.location.reload();
      } else {
        this._onHideOverlay();
      }
    }
  }

  _reconnect () {
    if ( this._disconnected === true && this._connecting === false && this._debounceTimerId === undefined ) {
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

window.customElements.define(CasperServerOverlay.is, CasperServerOverlay);
