import { createElement } from "react";
import { createPlugin } from "@fullcalendar/core";
import type { CustomContentGenerator, ViewProps } from "@fullcalendar/core";
import { AgendaStreamView, type AgendaStreamViewProps } from "./AgendaStreamView";

type AgendaStreamBridgeProps = Pick<
  AgendaStreamViewProps,
  "displayMonth" | "events" | "onEventSelect" | "selectedEventId" | "showRail"
>;

let agendaStreamBridge: AgendaStreamBridgeProps = {
  events: [],
  displayMonth: undefined,
  onEventSelect: undefined,
  selectedEventId: null,
  showRail: true,
};

export function setAgendaStreamViewBridge(nextBridge: AgendaStreamBridgeProps) {
  agendaStreamBridge = nextBridge;
}

export const agendaStreamViewContent: CustomContentGenerator<ViewProps> = (props) =>
  createElement(AgendaStreamView, {
    ...props,
    ...agendaStreamBridge,
  });

export const agendaStreamPlugin = createPlugin({
  name: "agendaStream",
  views: {
    agendaStreamWeek: {
      type: "timeGrid",
      duration: { weeks: 1 },
      buttonText: "Stream",
      content: agendaStreamViewContent,
    },
  },
});
