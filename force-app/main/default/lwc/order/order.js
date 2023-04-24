import { LightningElement, wire, track } from 'lwc';
import { subscribe, publish, unsubscribe, MessageContext } from 'lightning/messageService';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createOrder from '@salesforce/apex/OrderController.createOrder';
import CHECKOUT_MESSAGE_CHANNEL from '@salesforce/messageChannel/CheckoutMessageChannel__c';


import getProducts from '@salesforce/apex/ShoppingCartController.getProducts';
import deleteProducts from '@salesforce/apex/ShoppingCartController.deleteProducts';
import updateProductQuantity from '@salesforce/apex/ShoppingCartController.updateProductQuantity';
import deleteSelectedProducts from '@salesforce/apex/ShoppingCartController.deleteSelectedProducts';
import SHOPPING_CART_UPDATE_CHANNEL from '@salesforce/messageChannel/ShoppingCartUpdate__c';

const DELAY = 800;




export default class Order extends LightningElement {
    selectedProducts;
    @track selectedProducts0 = [];
    @track currentStep = 1;
    @track selectedDate;
    @wire(MessageContext) messageContext;

    subscription;

    @track products = [];
    @track totalPrice = 0;
    @track selectedProducts = [];

    @wire(MessageContext) messageContext;
    anyItemSelected = false;
    shoppingCartUpdateSubscription;
    delayTimeout;
    productMSRP;
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
                this.products = data.map(product => ({
                    ...product, productMSRP: Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: 'USD', // Replace with the appropriate currency code
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    }).format(product.MSRP__c), isSelected: false
                }));
            })
            .catch(error => {
                this.showErrorToast('Error Fetching Products', error.body.message);
            });
    }

    @wire(getProducts)
    wiredProducts({ error, data }) {
        if (data) {
            this.products = data.map(product => ({
                ...product, productMSRP: Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: 'USD', // Replace with the appropriate currency code
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(product.MSRP__c), isSelected: false, rowClass: 'slds-hint-parent'
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
                rowClass: isSelected ? 'slds-hint-parent selected-row' : 'slds-hint-parent',
            };
        });
        this.anyItemSelected = isSelected;
        if (this.selectAllCheckbox.indeterminate) {
            this.selectAllCheckbox.indeterminate = false;
        }
        this.selectedProducts = this.products.filter(product => product.isSelected);
        this.totalPrice = this.selectedProducts.reduce((total, product) => total + (product.MSRP__c * product.Quantity__c), 0);
        this.totalPrice = Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD', // Replace with the appropriate currency code
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(parseFloat(this.totalPrice.toFixed(2)));
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
        this.anyItemSelected = this.products.some((product) => product.isSelected);
        this.selectedProducts = this.products.filter(product => product.isSelected);
        this.totalPrice = this.selectedProducts.reduce((total, product) => total + (product.MSRP__c * product.Quantity__c), 0);
        this.totalPrice = Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD', // Replace with the appropriate currency code
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(parseFloat(this.totalPrice.toFixed(2)));
    }

    handleDeleteSelected() {
        const idsToDelete = this.selectedProducts.map(product => product.Id);
        deleteProducts({ productIds: idsToDelete })
            .then(() => {
                this.products = this.products.filter(product => !idsToDelete.includes(product.Id));
                this.selectedProducts = [];
                this.anyItemSelected = false;
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
        this.totalPrice = Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD', // Replace with the appropriate currency code
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(parseFloat(this.totalPrice.toFixed(2)));
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

    connectedCallback() {
        this.subscribeToMessageChannel();
    }

    disconnectedCallback() {
        this.unsubscribeToMessageChannel();
    }

    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                CHECKOUT_MESSAGE_CHANNEL,
                (message) => this.handleMessage(message)

            );
        }
    }

    unsubscribeToMessageChannel() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }

    handleMessage(message) {
        this.selectedProducts = message.selectedProducts;
        console.log(message.selectedProducts, 999);
    }

    handleConfirmOrder() {
        const productsAsMap = this.selectedProducts0.map(product => {
            return {
                ProductId: product.ProductId,
                ProductName__c: product.ProductName__c,
                ProductPrice__c: Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: 'USD', // Replace with the appropriate currency code
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(product.ProductPrice__c),
                Quantity__c: product.Quantity__c,
                PictureURL: product.PictureURL
            };
        });

        createOrder({ products: productsAsMap })
            .then(result => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Order created successfully',
                        variant: 'success',
                    }),
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error creating order',
                        message: error.body.message,
                        variant: 'error',
                    }),
                );
            });
    }


    submitOrder() {
        const productIds = this.products.filter(p => p.isSelected).map(p => p.Id);

        deleteSelectedProducts({ productIds: productIds })
            .then(() => {
                this.products = this.products.filter(p => !p.isSelected);
                this.currentStep = '1';
                this.updateStepStatus();
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Order submitted and selected products deleted',
                        variant: 'success',
                    }),
                );
            })
            .catch((error) => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body.message,
                        variant: 'error',
                    }),
                );
            });
    }

    get isButtonDisabled() {
        return !this.anyItemSelected;
    }

    get isStep1() {
        return this.currentStep === '1';
    }

    get isStep2() {
        return this.currentStep === '2';
    }

    get isStep3() {
        return this.currentStep === '3';
    }

    get isNextDisabled() {
        // Disable the "Next" button if no date is selected in step 2 or it's step 3.
        return (this.isStep2 && !this.selectedDate) || !this.anyItemSelected;
    }

    get nextButtonLabel() {
        return this.isStep1 ? 'Checkout' : 'Next';
    }

    connectedCallback() {
        // Set the initial step to '1' after the component is connected to the DOM.
        this.currentStep = '1';
    }

    handlePrevious() {
        if (this.currentStep > '1') {
            this.currentStep = (parseInt(this.currentStep) - 1).toString();
        }
    }

    handleNext() {
        if (this.isStep3) {
            this.submitOrder();
        } else {
            this.currentStep = (parseInt(this.currentStep) + 1).toString();
            this.updateStepStatus();
        }
    }

    handleDateChange(event) {
        this.selectedDate = event.target.value;
    }
}