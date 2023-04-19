public with sharing class OrderController {
    @AuraEnabled(Cacheable=true)
    public static Order_Item__c[] getOrderItems(Id orderId) {
        return [
            SELECT
                Id,
                Qty_S__c,
                Qty_M__c,
                Qty_L__c,
                Price__c,
                Product__r.Name,
                Product__r.MSRP__c,
                Product__r.Picture_URL__c
            FROM Order_Item__c
            WHERE Order__c = :orderId
            WITH SECURITY_ENFORCED
        ];
    }

    @AuraEnabled
    public static String createOrder(List<Map<String, Object>> products) {
        Order__c order = new Order__c();
        order.TotalPrice__c = 0;
        DateTime now = System.now();
        order.Time__c = Time.newInstance(now.hour(), now.minute(), now.second(), now.millisecond());
        insert order;

        List<Order_Item__c> orderItems = new List<Order_Item__c>();
        for (Map<String, Object> product : products) {
            Decimal productPrice = (Decimal)product.get('ProductPrice__c');
            Integer productQuantity = (Integer)product.get('Quantity__c');
            order.TotalPrice__c += productPrice * productQuantity;
            orderItems.add(new Order_Item__c(
                Order__c = order.Id,
                ProductName__c = (Id)product.get('ProductId'),
                Quantity__c = productQuantity
            ));
        }

        insert orderItems;
        update order;

        return order.Id;
    }


}
