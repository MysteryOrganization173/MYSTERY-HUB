export interface PaidOrderAlert {
  reference: string;
  reason: 'supplier_uncertain' | 'refund_exception' | 'fulfilment_failed' | 'flagged';
  updatedAt: string;
}

export interface PaidOrderAlerts {
  checkedAt: string;
  total: number;
  orders: PaidOrderAlert[];
}
