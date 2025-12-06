// Inventory Google Sheets 2-Way Sync Service
// Syncs inventory data, transactions, tickets, and employees with Google Sheets
// Last Updated: December 2025

import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { inventoryProducts, InventoryProduct } from './inventoryData';
import { inventoryTransactions, InventoryTransaction } from './inventoryTransactions';
import { TEAM_MEMBERS, TeamMember as TeamRoleMember } from './team-roles';
import { allTickets, Ticket } from './ticketsData';

// Handle private key - works with both escaped \n and actual newlines
const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, '\n')
  ?.replace(/\r\n/g, '\n');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Use inventory-specific spreadsheet ID or fall back to main one
const INVENTORY_SHEETS_ID = process.env.INVENTORY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

class InventorySheetsSync {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  async init(): Promise<boolean> {
    if (this.initialized && this.doc) return true;

    if (!INVENTORY_SHEETS_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
      console.warn('Google Sheets credentials not configured for inventory sync');
      return false;
    }

    try {
      this.doc = new GoogleSpreadsheet(INVENTORY_SHEETS_ID, serviceAccountAuth);
      await this.doc.loadInfo();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets for inventory:', error);
      return false;
    }
  }

  // ===== INVENTORY PRODUCTS SYNC =====

  async syncInventoryToSheets(): Promise<{ success: boolean; synced: number; error?: string }> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      return { success: false, synced: 0, error: 'Google Sheets not initialized' };
    }

    try {
      let sheet = this.doc.sheetsByTitle['inventory'];

      // Create sheet if it doesn't exist
      if (!sheet) {
        sheet = await this.doc.addSheet({
          title: 'inventory',
          headerValues: [
            'productId', 'productName', 'category', 'description',
            'unit', 'cost', 'price', 'currentQty',
            'minQty', 'maxQty', 'supplier', 'location', 'imageUrl'
          ]
        });
      }

      // Clear existing data and add fresh
      const rows = await sheet.getRows();
      for (const row of rows) {
        await row.delete();
      }

      // Add inventory products
      for (const product of inventoryProducts) {
        await sheet.addRow({
          productId: product.productId,
          productName: product.productName,
          category: product.category,
          description: product.description || '',
          unit: product.unit,
          cost: product.cost,
          price: product.price,
          currentQty: product.currentQty,
          minQty: product.minQty,
          maxQty: product.maxQty,
          supplier: product.supplier,
          location: product.location || '',
          imageUrl: product.imageUrl || ''
        });
      }

      return { success: true, synced: inventoryProducts.length };
    } catch (error) {
      return { success: false, synced: 0, error: String(error) };
    }
  }

  async getInventoryFromSheets(): Promise<InventoryProduct[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return inventoryProducts;

    try {
      const sheet = this.doc.sheetsByTitle['inventory'];
      if (!sheet) return inventoryProducts;

      const rows = await sheet.getRows();
      return rows.map(row => ({
        productId: row.get('productId'),
        productName: row.get('productName'),
        category: row.get('category'),
        description: row.get('description'),
        unit: row.get('unit'),
        cost: parseFloat(row.get('cost')) || 0,
        price: parseFloat(row.get('price')) || 0,
        currentQty: parseInt(row.get('currentQty')) || 0,
        minQty: parseInt(row.get('minQty')) || 0,
        maxQty: parseInt(row.get('maxQty')) || 0,
        supplier: row.get('supplier'),
        location: row.get('location'),
        imageUrl: row.get('imageUrl')
      }));
    } catch (error) {
      console.error('Error fetching inventory from sheets:', error);
      return inventoryProducts;
    }
  }

  // ===== TRANSACTIONS SYNC =====

  async syncTransactionsToSheets(): Promise<{ success: boolean; synced: number; error?: string }> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      return { success: false, synced: 0, error: 'Google Sheets not initialized' };
    }

    try {
      let sheet = this.doc.sheetsByTitle['transactions'];

      if (!sheet) {
        sheet = await this.doc.addSheet({
          title: 'transactions',
          headerValues: [
            'inventoryId', 'itemId', 'dateTime', 'amount', 'referenceNumber',
            'price', 'cost', 'type', 'status', 'deliveryPhoto', 'notes'
          ]
        });
      }

      // Clear and resync
      const rows = await sheet.getRows();
      for (const row of rows) {
        await row.delete();
      }

      for (const transaction of inventoryTransactions) {
        await sheet.addRow({
          inventoryId: transaction.inventoryId,
          itemId: transaction.itemId,
          dateTime: transaction.dateTime,
          amount: transaction.amount,
          referenceNumber: transaction.referenceNumber,
          price: transaction.price,
          cost: transaction.cost,
          type: transaction.type,
          status: transaction.status,
          deliveryPhoto: transaction.deliveryPhoto || '',
          notes: transaction.notes || ''
        });
      }

      return { success: true, synced: inventoryTransactions.length };
    } catch (error) {
      return { success: false, synced: 0, error: String(error) };
    }
  }

  async getTransactionsFromSheets(): Promise<InventoryTransaction[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return inventoryTransactions;

    try {
      const sheet = this.doc.sheetsByTitle['transactions'];
      if (!sheet) return inventoryTransactions;

      const rows = await sheet.getRows();
      return rows.map(row => ({
        inventoryId: row.get('inventoryId'),
        itemId: row.get('itemId'),
        dateTime: row.get('dateTime'),
        amount: parseInt(row.get('amount')) || 0,
        referenceNumber: row.get('referenceNumber'),
        price: parseFloat(row.get('price')) || 0,
        cost: parseFloat(row.get('cost')) || 0,
        type: row.get('type') as InventoryTransaction['type'],
        status: row.get('status') as InventoryTransaction['status'],
        deliveryPhoto: row.get('deliveryPhoto'),
        notes: row.get('notes')
      }));
    } catch (error) {
      console.error('Error fetching transactions from sheets:', error);
      return inventoryTransactions;
    }
  }

  // ===== TICKETS SYNC =====

  async syncTicketsToSheets(): Promise<{ success: boolean; synced: number; error?: string }> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      return { success: false, synced: 0, error: 'Google Sheets not initialized' };
    }

    try {
      let sheet = this.doc.sheetsByTitle['tickets'];

      if (!sheet) {
        sheet = await this.doc.addSheet({
          title: 'tickets',
          headerValues: [
            'ticketId', 'ticketType', 'status', 'createdAt', 'completedAt',
            'createdBy', 'createdByName', 'assignedTo', 'assignedToName',
            'jobId', 'jobName', 'jobAddress', 'city', 'state',
            'customerName', 'customerPhone', 'totalCost', 'totalPrice',
            'materials', 'notes'
          ]
        });
      }

      // Clear and resync
      const rows = await sheet.getRows();
      for (const row of rows) {
        await row.delete();
      }

      for (const ticket of allTickets) {
        await sheet.addRow({
          ticketId: ticket.ticketId,
          ticketType: ticket.ticketType,
          status: ticket.status,
          createdAt: ticket.createdAt,
          completedAt: ticket.completedAt || '',
          createdBy: ticket.createdBy,
          createdByName: ticket.createdByName,
          assignedTo: ticket.assignedTo || '',
          assignedToName: ticket.assignedToName || '',
          jobId: ticket.jobId || '',
          jobName: ticket.jobName || '',
          jobAddress: ticket.jobAddress || '',
          city: ticket.city || '',
          state: ticket.state || '',
          customerName: ticket.customerName || '',
          customerPhone: ticket.customerPhone || '',
          totalCost: ticket.totalCost,
          totalPrice: ticket.totalPrice,
          materials: JSON.stringify(ticket.materials),
          notes: ticket.notes || ''
        });
      }

      return { success: true, synced: allTickets.length };
    } catch (error) {
      return { success: false, synced: 0, error: String(error) };
    }
  }

  // ===== EMPLOYEES SYNC =====

  async syncEmployeesToSheets(): Promise<{ success: boolean; synced: number; error?: string }> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      return { success: false, synced: 0, error: 'Google Sheets not initialized' };
    }

    try {
      let sheet = this.doc.sheetsByTitle['employees'];

      if (!sheet) {
        sheet = await this.doc.addSheet({
          title: 'employees',
          headerValues: [
            'id', 'name', 'slug', 'email', 'phone', 'role', 'pin',
            'isActive', 'permissions', 'createdAt'
          ]
        });
      }

      // Clear and resync
      const rows = await sheet.getRows();
      for (const row of rows) {
        await row.delete();
      }

      for (const member of TEAM_MEMBERS) {
        await sheet.addRow({
          id: member.id,
          name: member.name,
          slug: member.slug,
          email: member.email,
          phone: member.phone || '',
          role: member.role,
          pin: member.pin || '',
          isActive: member.isActive ? 'TRUE' : 'FALSE',
          permissions: JSON.stringify(member.permissions),
          createdAt: member.createdAt
        });
      }

      return { success: true, synced: TEAM_MEMBERS.length };
    } catch (error) {
      return { success: false, synced: 0, error: String(error) };
    }
  }

  async getEmployeesFromSheets(): Promise<TeamRoleMember[]> {
    const ready = await this.init();
    if (!ready || !this.doc) return TEAM_MEMBERS;

    try {
      const sheet = this.doc.sheetsByTitle['employees'];
      if (!sheet) return TEAM_MEMBERS;

      const rows = await sheet.getRows();
      return rows.map(row => ({
        id: row.get('id'),
        name: row.get('name'),
        slug: row.get('slug'),
        email: row.get('email'),
        phone: row.get('phone'),
        role: row.get('role') as TeamRoleMember['role'],
        pin: row.get('pin'),
        isActive: row.get('isActive') === 'TRUE',
        permissions: JSON.parse(row.get('permissions') || '[]'),
        createdAt: row.get('createdAt')
      }));
    } catch (error) {
      console.error('Error fetching employees from sheets:', error);
      return TEAM_MEMBERS;
    }
  }

  // ===== FULL SYNC =====

  async syncAllToSheets(): Promise<{
    success: boolean;
    inventory: { synced: number; error?: string };
    transactions: { synced: number; error?: string };
    tickets: { synced: number; error?: string };
    employees: { synced: number; error?: string };
  }> {
    const [inventory, transactions, tickets, employees] = await Promise.all([
      this.syncInventoryToSheets(),
      this.syncTransactionsToSheets(),
      this.syncTicketsToSheets(),
      this.syncEmployeesToSheets()
    ]);

    return {
      success: inventory.success && transactions.success && tickets.success && employees.success,
      inventory: { synced: inventory.synced, error: inventory.error },
      transactions: { synced: transactions.synced, error: transactions.error },
      tickets: { synced: tickets.synced, error: tickets.error },
      employees: { synced: employees.synced, error: employees.error }
    };
  }

  // ===== WATCH FOR CHANGES (Polling) =====

  async checkForUpdates(): Promise<{
    hasChanges: boolean;
    changedSheets: string[];
  }> {
    const ready = await this.init();
    if (!ready || !this.doc) {
      return { hasChanges: false, changedSheets: [] };
    }

    // In a real implementation, you would:
    // 1. Store last sync timestamps
    // 2. Compare with sheet modified times
    // 3. Return changed sheets

    // For now, return no changes
    return { hasChanges: false, changedSheets: [] };
  }

  // ===== ADD NEW TRANSACTION =====

  async addTransaction(transaction: InventoryTransaction): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      let sheet = this.doc.sheetsByTitle['transactions'];
      if (!sheet) return false;

      await sheet.addRow({
        inventoryId: transaction.inventoryId,
        itemId: transaction.itemId,
        dateTime: transaction.dateTime,
        amount: transaction.amount,
        referenceNumber: transaction.referenceNumber,
        price: transaction.price,
        cost: transaction.cost,
        type: transaction.type,
        status: transaction.status,
        deliveryPhoto: transaction.deliveryPhoto || '',
        notes: transaction.notes || ''
      });

      return true;
    } catch (error) {
      console.error('Error adding transaction to sheets:', error);
      return false;
    }
  }

  // ===== UPDATE INVENTORY ITEM =====

  async updateInventoryItem(product: InventoryProduct): Promise<boolean> {
    const ready = await this.init();
    if (!ready || !this.doc) return false;

    try {
      const sheet = this.doc.sheetsByTitle['inventory'];
      if (!sheet) return false;

      const rows = await sheet.getRows();
      const existingRow = rows.find(row => row.get('productId') === product.productId);

      if (existingRow) {
        existingRow.set('currentQty', product.currentQty);
        existingRow.set('cost', product.cost);
        existingRow.set('price', product.price);
        existingRow.set('minQty', product.minQty);
        existingRow.set('maxQty', product.maxQty);
        await existingRow.save();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating inventory item in sheets:', error);
      return false;
    }
  }
}

export const inventorySheetsSync = new InventorySheetsSync();
