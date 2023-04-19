import { LightningElement, wire, track  } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createOrder from '@salesforce/apex/OrderController.createOrder';
import CHECKOUT_MESSAGE_CHANNEL from '@salesforce/messageChannel/CheckoutMessageChannel__c';

export default class Order extends LightningElement {
    selectedProducts;
    @track selectedProducts0 = [];
    @track currentStep = 1;
    @track selectedDate;
    @wire(MessageContext) messageContext;

    subscription;

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
        console.log(message.selectedProducts,999);
    }

    handleConfirmOrder() {
        const productsAsMap = this.selectedProducts0.map(product => {
            return {
                ProductId: product.ProductId,
                ProductName__c: product.ProductName__c,
                ProductPrice__c: product.ProductPrice__c,
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


    

    get isStep1() {
        return this.currentStep === '1';
    }

    get isStep2() {
        return this.currentStep === '2';
    }

    get isStep3() {
        return this.currentStep === '3';
    }

    handlePrevious() {
        if (this.currentStep > '1') {
            this.currentStep = (parseInt(this.currentStep) - 1).toString();
        }
    }

    handleNext() {
        if (this.currentStep < '3') {
            this.currentStep = (parseInt(this.currentStep) + 1).toString();
        }
    }

    handleDateChange(event) {
        this.selectedDate = event.target.value;
    }
}