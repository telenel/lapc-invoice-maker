import { createPlugin } from "@fullcalendar/core";
import type { CustomContentGenerator, ViewProps } from "@fullcalendar/core";

export const agendaStreamViewContent: CustomContentGenerator<ViewProps> = () => null;

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
