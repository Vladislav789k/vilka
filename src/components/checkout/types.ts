export type CheckoutDraft = {
  addressLabel: string | null;
  addressId: number | null;
  addressLatitude: number | null;
  addressLongitude: number | null;
  apartment: string;
  entrance: string;
  floor: string;
  intercom: string;
  comment: string;
  leaveAtDoor: boolean;
};

export type CheckoutStep = "summary" | "addressPayment";

