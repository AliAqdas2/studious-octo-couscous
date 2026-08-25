import type { WorkflowResourceLink } from "../../db/schema/event-workflow-task-defs.js";

/** Named resources from COOKING-TRACEABILITY (must seed). */
export const WORKFLOW_RESOURCES = {
  vendorDirectory: {
    label: "Vendor Directory",
    url: "https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit",
  },
  vendorDirectoryLocal: {
    label: "Vendor Directory (local md)",
    url: "BEO_System_docs/Vendor Directory.md",
    optional: true,
  },
  fareharborHowTo: {
    label: "How to Add Events to FareHarbor",
    url: "https://drive.google.com/file/d/1b7r8q-jcbn4uZ09IftUSHdaLUuZ7FMnl/view",
  },
  beoShellHowTo: {
    label: "How to make a BEO Shell",
    url: "https://drive.google.com/file/d/1b7r8q-jcbn4uZ09IftUSHdaLUuZ7FMnl/view",
  },
  recipeCardsHowTo: {
    label: "How to Create Recipe Cards",
    url: "https://drive.google.com/file/d/1nTWDc2MRYW0tseNMDLnAtnqGUr1zyMNU/view",
  },
  qrCodesFolder: {
    label: "QR Codes folder",
    url: "https://drive.google.com/drive/folders/1qDXF2mUG_lSHrHyrGOviqHTwbov3sOmo",
  },
  inventoryLinks: {
    label: "Inventory Links",
    url: "https://docs.google.com/document/d/1WSsg6tgUGXv3bYspElOWjQvYFJnnVLXXLQI2gd0oh8U/edit",
  },
  postEventSurvey: {
    label: "Post Event Survey Form",
    url: "https://docs.google.com/forms/d/17shTljWmlrpEvZBhljLFsu3oUQCeR_rQEGFjRr6LUJw/edit",
  },
  eventPhotosDrive: {
    label: "Event Photos Drive",
    url: "https://drive.google.com/drive/folders/1un3gg73vMrmkbLR_8BaHqw1XLTtHrC1I",
  },
  companyHandbook: {
    label: "Company Handbook",
    url: "https://docs.google.com/document/d/19OsGb5N7y_GIgUsYuSsfjTxVBx65Mn_zPH5_mH3grO0/edit",
  },
  slackSalesAlert: {
    label: "Slack Salesalert (optional)",
    url: "https://mangia-dc.slack.com/archives/C03UU3WPUR1",
    optional: true,
  },
  wattzDesign: {
    label: "Wattz Design (Owings, MD) — embroidery",
    url: "https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit",
  },
  minutemanPress: {
    label: "Minuteman Press (Dunkirk, MD) — embroidery",
    url: "https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit",
  },
  basecampDc: {
    label: "Basecamp DC — logo aprons",
    url: "https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit",
  },
  qualityGlassEngraving: {
    label: "Quality Glass Engraving",
    url: "https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit",
  },
  georgetownOliveOil: {
    label: "Georgetown Olive Oil",
    url: "https://georgetownoliveoil.com",
  },
} as const satisfies Record<string, WorkflowResourceLink>;

export const ALL_WORKFLOW_RESOURCE_LINKS: WorkflowResourceLink[] = Object.values(
  WORKFLOW_RESOURCES
);
