/**
 * Copyright since 2007 PrestaShop SA and Contributors
 * PrestaShop is an International Registered Trademark & Property of PrestaShop SA
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Open Software License (OSL 3.0)
 * that is bundled with this package in the file LICENSE.md.
 * It is also available through the world-wide-web at this URL:
 * https://opensource.org/licenses/OSL-3.0
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@prestashop.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade PrestaShop to newer
 * versions in the future. If you wish to customize PrestaShop for your
 * needs please refer to https://devdocs.prestashop.com/ for more information.
 *
 * @author    PrestaShop SA and Contributors <contact@prestashop.com>
 * @copyright Since 2007 PrestaShop SA and Contributors
 * @license   https://opensource.org/licenses/OSL-3.0 Open Software License (OSL 3.0)
 */

/* eslint max-classes-per-file: ["error", 2] */

import ResizeObserver from 'resize-observer-polyfill';
import {
  ModalContainerType, ModalContainer, ModalType, ModalParams, Modal,
} from '@components/modal/modal';
import IframeEvent from '@components/modal/iframe-event';

export interface IframeModalContainerType extends ModalContainerType {
  iframe: HTMLIFrameElement;
  loader: HTMLElement;
  spinner: HTMLElement;
}
export interface IframeModalType extends ModalType {
  modal: IframeModalContainerType;
  render: (content: string, hideIframe?: boolean) => void;
}
export type IframeCallbackFunction = (iframe:HTMLIFrameElement, event: Event) => void;
export type IframeEventCallbackFunction = (event: IframeEvent) => void;
export type IframeModalParams = ModalParams & {
  modalTitle?: string;
  onLoaded?: IframeCallbackFunction,
  onUnload?: IframeCallbackFunction,
  onIframeEvent?: IframeEventCallbackFunction,
  iframeUrl: string;
  autoSize: boolean;
  autoSizeContainer: string;
}
export type InputIframeModalParams = Partial<IframeModalParams> & {
  iframeUrl: string; // iframeUrl is mandatory in input
};

/**
 * This class is used to build the modal DOM elements, it is not usable as is because it doesn't even have a show
 * method and the elements are created but not added to the DOM. It just creates a basic DOM structure of a
 * Bootstrap modal, thus keeping the logic class of the modal separated.
 *
 * This container is built on the basic ModalContainer and adds an iframe to load external content along with a
 * loader div on top of it.
 *
 * @param {InputIframeModalParams} inputParams
 */
export class IframeModalContainer extends ModalContainer implements IframeModalContainerType {
  iframe!: HTMLIFrameElement;

  loader!: HTMLElement;

  spinner!: HTMLElement;

  /* This constructor is important to force the input type but ESLint is not happy about it*/
  /* eslint-disable no-useless-constructor */
  constructor(params: IframeModalParams) {
    super(params);
  }

  buildModalContainer(params: IframeModalParams): void {
    super.buildModalContainer(params);
    this.container.classList.add('modal-iframe');

    // Message is hidden by default
    this.message.classList.add('d-none');

    this.iframe = document.createElement('iframe');
    this.iframe.frameBorder = '0';
    this.iframe.scrolling = 'auto';
    this.iframe.width = '100%';
    if (!params.autoSize) {
      this.iframe.height = '100%';
    }

    this.loader = document.createElement('div');
    this.loader.classList.add('modal-iframe-loader');

    this.spinner = document.createElement('div');
    this.spinner.classList.add('spinner');

    this.loader.appendChild(this.spinner);
    this.body.append(this.loader, this.iframe);
  }
}

/**
 * This modal opens an url inside a modal, it then can handle two specific callbacks
 * - onLoaded: called when the iframe has juste been refreshed
 * - onUnload: called when the iframe is about to refresh (so it is unloaded)
 */
export class IframeModal extends Modal implements IframeModalType {
  modal!: IframeModalContainerType;

  protected autoSize!: boolean;

  protected autoSizeContainer!: string;

  protected resizeObserver?: ResizeObserver | null;

  constructor(
    inputParams: InputIframeModalParams,
  ) {
    const params: IframeModalParams = {
      id: 'iframe-modal',
      closable: false,
      autoSize: true,
      autoSizeContainer: 'body',
      ...inputParams,
    };
    super(params);
  }

  protected initContainer(params: IframeModalParams): void {
    // Construct the container
    this.modal = new IframeModalContainer(params);
    super.initContainer(params);

    this.autoSize = params.autoSize;
    this.autoSizeContainer = params.autoSizeContainer;
    this.modal.iframe.addEventListener('load', (loadedEvent: Event) => {
      this.hideLoading();
      if (params.onLoaded) {
        params.onLoaded(this.modal.iframe, loadedEvent);
      }

      if (this.modal.iframe.contentWindow) {
        this.modal.iframe.contentWindow.addEventListener('beforeunload', (unloadEvent: BeforeUnloadEvent) => {
          if (params.onUnload) {
            params.onUnload(this.modal.iframe, unloadEvent);
          }
          this.showLoading();
        });

        // Auto resize the iframe container
        this.initAutoResize();
      }
    });

    this.$modal.on('shown.bs.modal', () => {
      this.modal.iframe.src = params.iframeUrl;
    });

    window.addEventListener(IframeEvent.parentWindowEvent, ((event: IframeEvent) => {
      if (params.onIframeEvent) {
        params.onIframeEvent(event);
      }
    }) as EventListener);
  }

  render(content: string, hideIframe: boolean = true): void {
    this.modal.message.innerHTML = content;
    this.modal.message.classList.remove('d-none');

    if (hideIframe) {
      this.hideIframe();
    }

    this.autoResize();
    this.hideLoading();
  }

  showLoading(): void {
    this.modal.loader.classList.remove('d-none');
  }

  hideLoading(): void {
    this.modal.loader.classList.add('d-none');
  }

  hide(): void {
    super.hide();
    this.cleanResizeObserver();
  }

  hideIframe(): void {
    this.modal.iframe.classList.add('d-none');
  }

  private getResizableContainer(): HTMLElement | null {
    if (this.autoSize && this.modal.iframe.contentWindow) {
      return this.modal.iframe.contentWindow.document.querySelector(this.autoSizeContainer);
    }

    return null;
  }

  private initAutoResize(): void {
    const iframeContainer: HTMLElement | null = this.getResizableContainer();

    if (iframeContainer) {
      this.cleanResizeObserver();
      this.resizeObserver = new ResizeObserver(() => {
        this.autoResize();
      });

      this.resizeObserver.observe(iframeContainer);
    }
    this.autoResize();
  }

  private cleanResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private autoResize(): void {
    const iframeContainer: HTMLElement | null = this.getResizableContainer();

    if (iframeContainer) {
      const iframeScrollHeight = iframeContainer.scrollHeight;
      const contentHeight = this.getOuterHeight(this.modal.message)
        + iframeScrollHeight;

      // Avoid applying height of 0 (on first load for example)
      if (contentHeight) {
        this.modal.body.style.height = `${contentHeight}px`;
      }
    }
  }

  private getOuterHeight(element: HTMLElement): number {
    // If the element height is 0 it is likely empty or hidden, then no need to compute the margin
    if (!element.offsetHeight) {
      return 0;
    }

    let height = element.offsetHeight;
    const style: CSSStyleDeclaration = getComputedStyle(element);

    height += parseInt(style.marginTop, 10) + parseInt(style.marginBottom, 10);

    return height;
  }
}

export default IframeModal;
