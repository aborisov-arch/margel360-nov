import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { eventTypeBg, itemNameBg, paymentBg, pipelineBg, timeOfDayBg } from "./labels-bg.ts";

Deno.test("eventTypeBg uses event_id, then the stored English title", () => {
  assertEquals(eventTypeBg({ event_id: "evening", event_type: "Evening Event" }), "Вечерно събитие");
  assertEquals(eventTypeBg({ event_id: null, event_type: "Corporate Event — 8 hours" }), "Корпоративно събитие — 8 часа");
  assertEquals(eventTypeBg({ event_type: "Corporate Event - 4 hours" }), "Корпоративно събитие — 4 часа");
  assertEquals(eventTypeBg({ event_type: "Children's Birthday - Daytime" }), "Детски рожден ден — дневно");
  assertEquals(eventTypeBg({ event_type: "Рожден ден (ръчно)" }), "Рожден ден (ръчно)");
});

Deno.test("item, payment, pipeline and time labels are Bulgarian", () => {
  assertEquals(itemNameBg({ id: "photo2", name: "Photographer 2h" }), "Фотограф за 2 часа");
  assertEquals(itemNameBg({ id: "benedo_st", name: "San Benedetto still 0.5L" }), "San Benedetto негазирана 0.5л");
  assertEquals(itemNameBg({ id: "unknown", name: "Custom" }), "Custom");
  assertEquals(paymentBg("transfer"), "Банков превод");
  assertEquals(pipelineBg("confirmed"), "Потвърдени");
  assertEquals(timeOfDayBg({ time_of_day: "day" }), "Дневно (до 17:30)");
  assertEquals(timeOfDayBg({ arrival_time: "19:30" }), "Вечер · пристигане 19:30");
});
