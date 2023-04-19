public with sharing class ShoppingCartController {
    @AuraEnabled(cacheable=true)
    public static List<ShoppingCart__c> getProducts() {
        return [SELECT Id, Name,ProductName__c, MSRP__c,PictureURL__c, Quantity__c FROM ShoppingCart__c];
    }

    @AuraEnabled
    public static void deleteProducts(List<Id> productIds) {
        List<ShoppingCart__c> productsToDelete = [SELECT Id FROM ShoppingCart__c WHERE Id IN :productIds];
        delete productsToDelete;
    }

    @AuraEnabled
    public static void updateProductQuantity(ShoppingCart__c product) {
        update product;
    }

    @AuraEnabled
    public static void addToCart(String productId) {
        // Check if the product ID is provided
        if (String.isBlank(productId)) {
            throw new AuraHandledException('Product ID is required');
        }

        // Get the product details
        Product__c product = [SELECT Id, Name,Picture_URL__c, MSRP__c FROM Product__c WHERE Id = :productId LIMIT 1];

        // Check if the product is already in the shopping cart
        List<ShoppingCart__c> existingCartItems = [
            SELECT Id, Quantity__c
            FROM ShoppingCart__c
            WHERE Product__c = :productId
            LIMIT 1
        ];

        try {
            if (!existingCartItems.isEmpty()) {
                // If the product is already in the cart, increase the quantity by one
                ShoppingCart__c cartItem = existingCartItems[0];
                cartItem.Quantity__c += 1;
                update cartItem;
            } else {
                // If the product is not in the cart, create a new ShoppingCart__c record
                ShoppingCart__c cartItem = new ShoppingCart__c();
                cartItem.Product__c = product.Id;
                cartItem.ProductName__c = product.Name;
                cartItem.MSRP__c = product.MSRP__c;
                cartItem.PictureURL__c = product.Picture_URL__c;
                cartItem.Quantity__c = 1; // Set the initial quantity to 1

                insert cartItem;
            }
        } catch (DmlException e) {
            throw new AuraHandledException('Error adding product to cart: ' + e.getMessage());
        }
    }
}
