import CounterModel from "../models/counter.model";

export const generateReservationId = async (): Promise<string> => {
  const counter = await CounterModel.findOneAndUpdate(
    { key: "reservationId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const number = counter.seq.toString().padStart(2, "0");
  return `TLB-${number}`;
};
