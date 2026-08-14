/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import ActivationPending from './pages/ActivationPending';
import ActivityLog from './pages/ActivityLog';
import AILogs from './pages/AILogs';
import Assets from './pages/Assets';
import AutomatedCallsDashboard from './pages/AutomatedCallsDashboard';
import AutomatedCallDetail from './pages/AutomatedCallDetail';
import CalendarView from './pages/CalendarView';
import ClientDatabase from './pages/ClientDatabase';
import ClientProfile from './pages/ClientProfile';
import ConfirmedEvents from './pages/ConfirmedEvents';
import Dashboard from './pages/Dashboard';
import Email from './pages/Email';
import EventDetail from './pages/EventDetail';
import EventTemplates from './pages/EventTemplates';
import Events from './pages/Events';
import Home from './pages/Home';
import LeadDetail from './pages/LeadDetail';
import Leads from './pages/Leads';
import MyOnboarding from './pages/MyOnboarding';
import PipelineEmailAutomations from './pages/PipelineEmailAutomations';
import RoleAssignment from './pages/RoleAssignment';
import Settings from './pages/Settings';
import SpamEmails from './pages/SpamEmails';
import TaskSyncAdmin from './pages/TaskSyncAdmin';
import Tasks from './pages/Tasks';
import Users from './pages/Users';
import Recruitment from './pages/Recruitment';
import CandidateDetail from './pages/CandidateDetail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ActivationPending": ActivationPending,
    "ActivityLog": ActivityLog,
    "AILogs": AILogs,
    "Assets": Assets,
    "AutomatedCallsDashboard": AutomatedCallsDashboard,
    "AutomatedCallDetail": AutomatedCallDetail,
    "CalendarView": CalendarView,
    "CandidateDetail": CandidateDetail,
    "ClientDatabase": ClientDatabase,
    "ClientProfile": ClientProfile,
    "ConfirmedEvents": ConfirmedEvents,
    "Dashboard": Dashboard,
    "Email": Email,
    "EventDetail": EventDetail,
    "EventTemplates": EventTemplates,
    "Events": Events,
    "Home": Home,
    "LeadDetail": LeadDetail,
    "Leads": Leads,
    "MyOnboarding": MyOnboarding,
    "PipelineEmailAutomations": PipelineEmailAutomations,
    "Recruitment": Recruitment,
    "RoleAssignment": RoleAssignment,
    "Settings": Settings,
    "SpamEmails": SpamEmails,
    "TaskSyncAdmin": TaskSyncAdmin,
    "Tasks": Tasks,
    "Users": Users,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};