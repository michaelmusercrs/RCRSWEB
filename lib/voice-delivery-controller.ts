// Voice-Controlled Delivery System for River City Roofing Solutions
// Integrates voice commands, GPS, and push notifications with delivery workflow
// Last Updated: December 2025

import { voiceService, pushNotificationService, gpsTrackingService, driverAssistance } from './voice-notification-service';
import { tickets, jobTickets, getTicketById, getTicketsByDriver, Ticket } from './ticketsData';
import { inventoryProducts } from './inventoryData';

// Voice Command Types
export type VoiceCommand =
  | 'read_checklist'
  | 'next_item'
  | 'previous_item'
  | 'confirm_item'
  | 'skip_item'
  | 'read_ticket'
  | 'start_navigation'
  | 'mark_arrived'
  | 'mark_delivered'
  | 'help'
  | 'stop';

// Voice Control State
interface VoiceControlState {
  isListening: boolean;
  currentTicket: Ticket | null;
  checklistIndex: number;
  lastCommand: string;
  lastCommandTime: string;
}

// Delivery Item for voice reading
interface VoiceDeliveryItem {
  index: number;
  productName: string;
  quantity: number;
  unit: string;
  verified: boolean;
  notes?: string;
}

// Voice Command Result
interface CommandResult {
  success: boolean;
  message: string;
  spokenResponse: string;
  nextAction?: string;
}

// Voice Recognition Class (using Web Speech API)
class VoiceRecognitionService {
  private recognition: any = null;
  private isSupported: boolean = false;
  private onCommandCallback: ((command: string) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.isSupported = true;

        this.recognition.onresult = (event: any) => {
          const last = event.results.length - 1;
          const command = event.results[last][0].transcript.toLowerCase().trim();
          if (this.onCommandCallback) {
            this.onCommandCallback(command);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
        };
      }
    }
  }

  isAvailable(): boolean {
    return this.isSupported;
  }

  startListening(callback: (command: string) => void): void {
    if (!this.isSupported || !this.recognition) return;
    this.onCommandCallback = callback;
    this.recognition.start();
  }

  stopListening(): void {
    if (!this.isSupported || !this.recognition) return;
    this.recognition.stop();
    this.onCommandCallback = null;
  }
}

// Main Voice Delivery Controller
class VoiceDeliveryController {
  private state: VoiceControlState = {
    isListening: false,
    currentTicket: null,
    checklistIndex: 0,
    lastCommand: '',
    lastCommandTime: ''
  };

  private voiceRecognition = new VoiceRecognitionService();
  private commandHistory: Array<{ command: string; result: CommandResult; timestamp: string }> = [];

  // Wake words for command activation
  private wakeWords = ['hey driver', 'okay driver', 'driver', 'hey river city'];

  // Command mappings
  private commandMap: Record<string, VoiceCommand> = {
    'read checklist': 'read_checklist',
    'checklist': 'read_checklist',
    'what do i have': 'read_checklist',
    'what am i loading': 'read_checklist',
    'next': 'next_item',
    'next item': 'next_item',
    'go next': 'next_item',
    'previous': 'previous_item',
    'previous item': 'previous_item',
    'go back': 'previous_item',
    'confirm': 'confirm_item',
    'verified': 'confirm_item',
    'got it': 'confirm_item',
    'loaded': 'confirm_item',
    'skip': 'skip_item',
    'skip item': 'skip_item',
    'ticket': 'read_ticket',
    'read ticket': 'read_ticket',
    'delivery details': 'read_ticket',
    'navigate': 'start_navigation',
    'start navigation': 'start_navigation',
    'take me there': 'start_navigation',
    'arrived': 'mark_arrived',
    'i am here': 'mark_arrived',
    'at location': 'mark_arrived',
    'delivered': 'mark_delivered',
    'complete': 'mark_delivered',
    'done': 'mark_delivered',
    'help': 'help',
    'commands': 'help',
    'what can i say': 'help',
    'stop': 'stop',
    'cancel': 'stop',
    'quiet': 'stop'
  };

  // Initialize voice control for a driver
  async initialize(driverId: string, driverName: string): Promise<boolean> {
    const initResult = await driverAssistance.initialize(driverId, driverName);

    if (initResult.voice) {
      voiceService.speak('Voice control initialized. Say "help" for available commands.');
    }

    return initResult.voice;
  }

  // Start listening for voice commands
  startListening(): void {
    if (!this.voiceRecognition.isAvailable()) {
      console.error('Voice recognition not available');
      return;
    }

    this.state.isListening = true;
    this.voiceRecognition.startListening((rawCommand) => {
      this.processVoiceInput(rawCommand);
    });

    voiceService.speak('Listening for commands.');
  }

  // Stop listening
  stopListening(): void {
    this.state.isListening = false;
    this.voiceRecognition.stopListening();
    voiceService.speak('Voice control paused.');
  }

  // Process voice input and extract command
  private processVoiceInput(rawInput: string): void {
    // Check for wake word
    let input = rawInput.toLowerCase();

    // Remove wake word if present
    for (const wake of this.wakeWords) {
      if (input.startsWith(wake)) {
        input = input.substring(wake.length).trim();
        break;
      }
    }

    // Find matching command
    const command = this.findCommand(input);
    if (command) {
      const result = this.executeCommand(command);
      this.commandHistory.push({
        command: input,
        result,
        timestamp: new Date().toISOString()
      });
    } else {
      voiceService.speak('I did not understand that command. Say help for available commands.');
    }
  }

  // Find command from input
  private findCommand(input: string): VoiceCommand | null {
    // Direct match
    if (this.commandMap[input]) {
      return this.commandMap[input];
    }

    // Partial match
    for (const [phrase, command] of Object.entries(this.commandMap)) {
      if (input.includes(phrase)) {
        return command;
      }
    }

    return null;
  }

  // Execute voice command
  executeCommand(command: VoiceCommand): CommandResult {
    this.state.lastCommand = command;
    this.state.lastCommandTime = new Date().toISOString();

    switch (command) {
      case 'read_checklist':
        return this.readChecklist();
      case 'next_item':
        return this.nextItem();
      case 'previous_item':
        return this.previousItem();
      case 'confirm_item':
        return this.confirmItem();
      case 'skip_item':
        return this.skipItem();
      case 'read_ticket':
        return this.readTicket();
      case 'start_navigation':
        return this.startNavigation();
      case 'mark_arrived':
        return this.markArrived();
      case 'mark_delivered':
        return this.markDelivered();
      case 'help':
        return this.readHelp();
      case 'stop':
        return this.stop();
      default:
        return {
          success: false,
          message: 'Unknown command',
          spokenResponse: 'I do not understand that command.'
        };
    }
  }

  // Load a ticket for voice control
  loadTicket(ticketId: string): boolean {
    const ticket = getTicketById(ticketId);
    if (!ticket) {
      voiceService.speak('Ticket not found.');
      return false;
    }

    this.state.currentTicket = ticket;
    this.state.checklistIndex = 0;

    voiceService.speak(
      'Ticket loaded. ' + ticket.jobName + '. ' +
      ticket.materials.length + ' items to load. Say read checklist to begin.'
    );

    return true;
  }

  // Read checklist command
  private readChecklist(): CommandResult {
    if (!this.state.currentTicket) {
      const response = 'No ticket loaded. Please select a delivery first.';
      voiceService.speak(response);
      return { success: false, message: 'No ticket', spokenResponse: response };
    }

    const ticket = this.state.currentTicket;
    const items = ticket.materials;

    if (items.length === 0) {
      const response = 'This ticket has no materials listed.';
      voiceService.speak(response);
      return { success: false, message: 'No materials', spokenResponse: response };
    }

    let script = 'Loading checklist for ' + ticket.jobName + '. ';
    script += items.length + ' items total. ';

    items.forEach((item, index) => {
      script += 'Item ' + (index + 1) + ': ' + item.quantity + ' ' + item.productName + '. ';
    });

    script += 'Say next to go through items one by one, or confirm all to verify the entire load.';

    voiceService.speak(script);

    return {
      success: true,
      message: 'Checklist read',
      spokenResponse: script,
      nextAction: 'next_item or confirm_all'
    };
  }

  // Next item command
  private nextItem(): CommandResult {
    if (!this.state.currentTicket) {
      const response = 'No ticket loaded.';
      voiceService.speak(response);
      return { success: false, message: 'No ticket', spokenResponse: response };
    }

    const items = this.state.currentTicket.materials;
    if (this.state.checklistIndex >= items.length) {
      const response = 'You have reached the end of the checklist. All items reviewed.';
      voiceService.speak(response);
      return { success: true, message: 'End of checklist', spokenResponse: response };
    }

    this.state.checklistIndex++;
    const item = items[this.state.checklistIndex - 1];

    const response = 'Item ' + this.state.checklistIndex + ' of ' + items.length + '. ' +
      item.quantity + ' ' + item.productName + '. ' +
      'Say confirm when loaded, or next for next item.';

    voiceService.speak(response);

    return {
      success: true,
      message: 'Item ' + this.state.checklistIndex,
      spokenResponse: response,
      nextAction: 'confirm_item or next_item'
    };
  }

  // Previous item command
  private previousItem(): CommandResult {
    if (!this.state.currentTicket) {
      const response = 'No ticket loaded.';
      voiceService.speak(response);
      return { success: false, message: 'No ticket', spokenResponse: response };
    }

    if (this.state.checklistIndex <= 1) {
      const response = 'You are at the first item.';
      voiceService.speak(response);
      return { success: false, message: 'At beginning', spokenResponse: response };
    }

    this.state.checklistIndex--;
    const item = this.state.currentTicket.materials[this.state.checklistIndex - 1];

    const response = 'Item ' + this.state.checklistIndex + '. ' +
      item.quantity + ' ' + item.productName + '.';

    voiceService.speak(response);

    return {
      success: true,
      message: 'Previous item',
      spokenResponse: response
    };
  }

  // Confirm item command
  private confirmItem(): CommandResult {
    if (!this.state.currentTicket || this.state.checklistIndex === 0) {
      const response = 'No item selected to confirm.';
      voiceService.speak(response);
      return { success: false, message: 'No item', spokenResponse: response };
    }

    const items = this.state.currentTicket.materials;
    const item = items[this.state.checklistIndex - 1];

    const response = item.productName + ' confirmed. ' +
      (this.state.checklistIndex < items.length
        ? 'Say next for next item.'
        : 'All items reviewed. Say delivered when ready to mark complete.');

    voiceService.speak(response);

    return {
      success: true,
      message: 'Item confirmed',
      spokenResponse: response,
      nextAction: this.state.checklistIndex < items.length ? 'next_item' : 'mark_delivered'
    };
  }

  // Skip item command
  private skipItem(): CommandResult {
    if (!this.state.currentTicket) {
      const response = 'No ticket loaded.';
      voiceService.speak(response);
      return { success: false, message: 'No ticket', spokenResponse: response };
    }

    const items = this.state.currentTicket.materials;
    if (this.state.checklistIndex >= items.length) {
      const response = 'End of checklist reached.';
      voiceService.speak(response);
      return { success: true, message: 'End reached', spokenResponse: response };
    }

    this.state.checklistIndex++;
    const response = 'Item skipped. ' +
      (this.state.checklistIndex <= items.length
        ? 'Moving to item ' + this.state.checklistIndex + '.'
        : 'End of checklist.');

    voiceService.speak(response);

    return {
      success: true,
      message: 'Item skipped',
      spokenResponse: response
    };
  }

  // Read ticket details
  private readTicket(): CommandResult {
    if (!this.state.currentTicket) {
      const response = 'No ticket loaded.';
      voiceService.speak(response);
      return { success: false, message: 'No ticket', spokenResponse: response };
    }

    const ticket = this.state.currentTicket;

    const response = 'Delivery ticket ' + ticket.ticketId + '. ' +
      'Job: ' + ticket.jobName + '. ' +
      'Address: ' + ticket.jobAddress + ', ' + ticket.city + '. ' +
      (ticket.customerName ? 'Customer: ' + ticket.customerName + '. ' : '') +
      'Materials: ' + ticket.materials.length + ' items. ' +
      'Total value: $' + ticket.totalPrice.toFixed(2) + '.';

    voiceService.speak(response);

    return {
      success: true,
      message: 'Ticket read',
      spokenResponse: response
    };
  }

  // Start navigation
  private startNavigation(): CommandResult {
    if (!this.state.currentTicket) {
      const response = 'No ticket loaded. Cannot start navigation.';
      voiceService.speak(response);
      return { success: false, message: 'No ticket', spokenResponse: response };
    }

    const ticket = this.state.currentTicket;
    const address = ticket.jobAddress + ', ' + ticket.city + ', ' + ticket.state;

    // Open Google Maps navigation
    const mapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address);

    if (typeof window !== 'undefined') {
      window.open(mapsUrl, '_blank');
    }

    const response = 'Starting navigation to ' + ticket.jobAddress + '. Opening maps.';
    voiceService.speak(response);

    return {
      success: true,
      message: 'Navigation started',
      spokenResponse: response
    };
  }

  // Mark arrived at location
  private markArrived(): CommandResult {
    if (!this.state.currentTicket) {
      const response = 'No ticket loaded.';
      voiceService.speak(response);
      return { success: false, message: 'No ticket', spokenResponse: response };
    }

    const ticket = this.state.currentTicket;

    const response = 'Arrival confirmed at ' + ticket.jobName + '. ' +
      (ticket.customerName ? 'Customer: ' + ticket.customerName + '. ' : '') +
      'Please unload materials and capture delivery photos.';

    voiceService.speak(response);

    // Trigger GPS location capture
    gpsTrackingService.getCurrentLocation();

    return {
      success: true,
      message: 'Marked arrived',
      spokenResponse: response,
      nextAction: 'unload_and_photo'
    };
  }

  // Mark delivery complete
  private markDelivered(): CommandResult {
    if (!this.state.currentTicket) {
      const response = 'No ticket loaded.';
      voiceService.speak(response);
      return { success: false, message: 'No ticket', spokenResponse: response };
    }

    const response = 'Delivery marked complete. Please capture signature and final photos before departing. Great job!';
    voiceService.speak(response, 'urgent');

    // Send notification
    pushNotificationService.notify(
      'Delivery Complete',
      'Ticket ' + this.state.currentTicket.ticketId + ' delivered successfully.',
      { priority: 'normal' }
    );

    return {
      success: true,
      message: 'Delivery complete',
      spokenResponse: response,
      nextAction: 'capture_signature'
    };
  }

  // Read help
  private readHelp(): CommandResult {
    const helpScript =
      'Available voice commands: ' +
      'Read checklist, to hear all items. ' +
      'Next, to go to next item. ' +
      'Previous, to go back. ' +
      'Confirm, when item is loaded. ' +
      'Skip, to skip an item. ' +
      'Ticket, to read delivery details. ' +
      'Navigate, to start GPS navigation. ' +
      'Arrived, when at the job site. ' +
      'Delivered, when unloading is complete. ' +
      'Stop, to pause voice control.';

    voiceService.speak(helpScript);

    return {
      success: true,
      message: 'Help read',
      spokenResponse: helpScript
    };
  }

  // Stop voice control
  private stop(): CommandResult {
    voiceService.stop();
    const response = 'Voice control stopped.';

    return {
      success: true,
      message: 'Stopped',
      spokenResponse: response
    };
  }

  // Get current state
  getState(): VoiceControlState {
    return { ...this.state };
  }

  // Get command history
  getCommandHistory(): Array<{ command: string; result: CommandResult; timestamp: string }> {
    return [...this.commandHistory];
  }

  // Get driver's pending deliveries
  getDriverDeliveries(driverId: string): Ticket[] {
    return getTicketsByDriver(driverId);
  }

  // Quick actions for button control (non-voice)
  quickReadChecklist(): void {
    this.executeCommand('read_checklist');
  }

  quickNextItem(): void {
    this.executeCommand('next_item');
  }

  quickConfirmItem(): void {
    this.executeCommand('confirm_item');
  }

  quickStartNavigation(): void {
    this.executeCommand('start_navigation');
  }
}

// TV/Tablet Display Controller for Warehouse
export class WarehouseDisplayController {
  private refreshInterval: number | null = null;

  // Get pending deliveries for display
  getPendingDeliveries(): Ticket[] {
    return tickets.filter(t =>
      t.ticketType === 'delivery' &&
      t.status !== 'completed' &&
      t.status !== 'cancelled'
    );
  }

  // Get today's deliveries
  getTodayDeliveries(): Ticket[] {
    const today = new Date().toISOString().split('T')[0];
    return tickets.filter(t => {
      const ticketDate = t.createdAt.split('T')[0];
      return ticketDate === today && t.ticketType === 'delivery';
    });
  }

  // Format for TV display
  formatForDisplay(deliveryTickets: Ticket[]): Array<{
    ticketId: string;
    jobName: string;
    address: string;
    itemCount: number;
    driver: string;
    status: string;
    priority: 'normal' | 'high' | 'urgent';
  }> {
    return deliveryTickets.map(ticket => ({
      ticketId: ticket.ticketId,
      jobName: ticket.jobName || 'Unknown Job',
      address: ticket.jobAddress + ', ' + ticket.city,
      itemCount: ticket.materials.length,
      driver: ticket.assignedToName || 'Unassigned',
      status: ticket.status,
      priority: ticket.status === 'created' ? 'urgent' : 'normal'
    }));
  }

  // Start auto-refresh for TV display
  startAutoRefresh(callback: (data: Ticket[]) => void, intervalMs: number = 30000): void {
    this.refreshInterval = window.setInterval(() => {
      callback(this.getPendingDeliveries());
    }, intervalMs);

    // Initial call
    callback(this.getPendingDeliveries());
  }

  // Stop auto-refresh
  stopAutoRefresh(): void {
    if (this.refreshInterval !== null) {
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Announce new delivery to warehouse speakers
  announceNewDelivery(ticket: Ticket): void {
    const announcement =
      'Attention warehouse. New delivery ticket ' + ticket.ticketId + '. ' +
      'Job: ' + ticket.jobName + '. ' +
      ticket.materials.length + ' items to pull. ' +
      'Driver: ' + (ticket.assignedToName || 'To be assigned') + '.';

    voiceService.speak(announcement, 'urgent');
  }
}

// Export instances
export const voiceDeliveryController = new VoiceDeliveryController();
export const warehouseDisplayController = new WarehouseDisplayController();

// Export types
export type { VoiceControlState, VoiceDeliveryItem, CommandResult };
