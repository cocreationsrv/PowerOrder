import { LightningElement, wire, track } from 'lwc';
import getProducts from '@salesforce/apex/ShoppingCartController.getProducts';
import deleteProducts from '@salesforce/apex/ShoppingCartController.deleteProducts';
import updateProductQuantity from '@salesforce/apex/ShoppingCartController.updateProductQuantity';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import CHECKOUT_MESSAGE_CHANNEL from '@salesforce/messageChannel/CheckoutMessageChannel__c';
import SHOPPING_CART_UPDATE_CHANNEL from '@salesforce/messageChannel/ShoppingCartUpdate__c';

const DELAY = 800;

export default class ShoppingCart extends LightningElement {
    @track products = [];
    @track totalPrice = 0;
    @track selectedProducts = [];

    @wire(MessageContext) messageContext;

    shoppingCartUpdateSubscription;
    delayTimeout;
    PictureURL__c;
    get isCartEmpty() {
        return this.products.length === 0;
    }

    connectedCallback() {
        // Subscribe to ShoppingCartUpdate message
        this.shoppingCartUpdateSubscription = subscribe(
            this.messageContext,
            SHOPPING_CART_UPDATE_CHANNEL,
            () => this.handleShoppingCartUpdate()
        );
    }

    handleShoppingCartUpdate() {
        // Refresh the products list from the server
        this.refreshProducts();
    }

    refreshProducts() {
        getProducts()
            .then(data => {
                this.products = data.map(product => ({ ...product, PictureURL: product.PictureURL__c, isSelected: false }));
            })
            .catch(error => {
                this.showErrorToast('Error Fetching Products', error.body.message);
            });
    }

    @wire(getProducts)
    wiredProducts({ error, data }) {
        if (data) {
            this.products = data.map(product => ({
                ...product, PictureURL: product.PictureURL__c, isSelected: false,rowClass: 'slds-hint-parent'
            }));
        } else if (error) {
            this.showErrorToast('Error Fetching Products', error.body.message);
        }
    }

    handleSelectAll(event) {
        const isSelected = event.target.checked;
        this.products = this.products.map(product => {
            return {
                ...product,
                isSelected: isSelected,
            };
        });
        if (this.selectAllCheckbox.indeterminate) {
            this.selectAllCheckbox.indeterminate = false;
        }
        this.selectedProducts = this.products.filter(product => product.isSelected);
        this.totalPrice = this.selectedProducts.reduce((total, product) => total + (product.MSRP__c * product.Quantity__c), 0);
        this.totalPrice = parseFloat(this.totalPrice.toFixed(2));
    }

    updateSelectAllCheckboxState() {
        const totalProducts = this.products.length;
        const selectedProducts = this.products.filter(product => product.isSelected).length;

        this.selectAllCheckbox = this.template.querySelector('input[type="checkbox"]');

        if (selectedProducts === 0) {
            this.selectAllCheckbox.indeterminate = false;
            this.selectAllCheckbox.checked = false;
        } else if (selectedProducts < totalProducts) {
            this.selectAllCheckbox.indeterminate = true;
            this.selectAllCheckbox.checked = false;
        } else {
            this.selectAllCheckbox.indeterminate = false;
            this.selectAllCheckbox.checked = true;
        }
    }

    handleSelection(event) {
        const selectedId = event.target.name;
        this.products.forEach(product => {
            if (product.Id === selectedId) {
                product.isSelected = !product.isSelected;
                product.rowClass = product.isSelected ? 'slds-hint-parent selected-row' : 'slds-hint-parent';
            }
        });
        this.updateSelectAllCheckboxState();
        this.selectedProducts = this.products.filter(product => product.isSelected);
        this.totalPrice = this.selectedProducts.reduce((total, product) => total + (product.MSRP__c * product.Quantity__c), 0);
        this.totalPrice = parseFloat(this.totalPrice.toFixed(2));
    }

    handleDeleteSelected() {
        const idsToDelete = this.selectedProducts.map(product => product.Id);
        deleteProducts({ productIds: idsToDelete })
            .then(() => {
                this.products = this.products.filter(product => !idsToDelete.includes(product.Id));
                this.selectedProducts = [];
                this.totalPrice = 0;
                this.showSuccessToast('Success', 'Selected products have been deleted.');
            })
            .catch(error => {
                this.showErrorToast('Error Deleting Products', error.body.message);
            });
    }

    handleQuantityChange(event) {
        const updatedItem = this.products.find(product => product.Id === event.target.name);
        updatedItem.Quantity__c = event.target.value;
        this.totalPrice = this.selectedProducts.reduce((total, product) => total + (product.MSRP__c * product.Quantity__c), 0);
        this.totalPrice = parseFloat(this.totalPrice.toFixed(2));
        this.delayedFireFilterChangeEvent(updatedItem);
    }

    handleCheckout() {
        publish(this.messageContext, CHECKOUT_MESSAGE_CHANNEL, {
            selectedProducts: this.selectedProducts
        });
    }

    delayedFireFilterChangeEvent(updatedItem) {
        window.clearTimeout(this.delayTimeout);
        this.delayTimeout = setTimeout(() => {
            updateProductQuantity({ product: updatedItem })
                .then(() => {
                    this.showSuccessToast('Success', 'Quantity updated successfully.');
                })
                .catch(error => {
                    this.showErrorToast('Error Updating Quantity', error.body.message);
                });
        }, DELAY);
    }

    showErrorToast(title, message) {
        const toastEvent = new ShowToastEvent({
            title: title,
            message: message,
            variant: 'error'
        });
        this.dispatchEvent(toastEvent);
    }

    showSuccessToast(title, message) {
        const toastEvent = new ShowToastEvent({
            title: title,
            message: message,
            variant: 'success'
        });
        this.dispatchEvent(toastEvent);
    }
}