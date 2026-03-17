/**
 * Delivery Settings API
 *
 * Manages centralized settings for the RCRS delivery ecosystem:
 * - AI agent configuration
 * - Notification rules
 * - Workflow settings
 * - Warehouse IoT controls
 * - Inventory settings
 * - Access control (roles/permissions)
 *
 * POST actions: update, reset, export, import, test-ai, test-iot, check-health
 * GET: returns all current settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth-service';
import { deliverySettingsService, SettingsCategory } from '@/lib/delivery-settings-service';
import { DeliveryAIAgent } from '@/lib/delivery-ai-agent';
import { WarehouseIoTService } from '@/lib/warehouse-iot-service';
import { SmartDeliveryEngine } from '@/lib/smart-delivery-engine';

// ============================================
// GET - Return all settings
// ============================================

export async function GET() {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = deliverySettingsService.getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[Settings API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Actions: update, reset, export, import, test-ai, test-iot, check-health
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      // ------------------------------------------
      // Update settings by category
      // ------------------------------------------
      case 'update': {
        const { category, updates } = body;
        if (!category || !updates) {
          return NextResponse.json(
            { success: false, error: 'category and updates are required' },
            { status: 400 }
          );
        }

        const validCategories: SettingsCategory[] = ['ai', 'notifications', 'workflow', 'warehouse', 'inventory', 'access'];
        if (!validCategories.includes(category)) {
          return NextResponse.json(
            { success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
            { status: 400 }
          );
        }

        const result = deliverySettingsService.updateSettings(category, updates);
        if (!result.success) {
          return NextResponse.json(
            { success: false, errors: result.errors },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `${category} settings updated successfully`,
          settings: deliverySettingsService.getSettingsByCategory(category),
        });
      }

      // ------------------------------------------
      // Reset to defaults
      // ------------------------------------------
      case 'reset': {
        const { category } = body;
        const settings = deliverySettingsService.resetToDefaults(category || undefined);
        return NextResponse.json({
          success: true,
          message: category ? `${category} settings reset to defaults` : 'All settings reset to defaults',
          settings,
        });
      }

      // ------------------------------------------
      // Export settings as JSON
      // ------------------------------------------
      case 'export': {
        const exported = deliverySettingsService.exportSettings();
        return NextResponse.json({
          success: true,
          data: exported,
          filename: `rcrs-delivery-settings-${new Date().toISOString().slice(0, 10)}.json`,
        });
      }

      // ------------------------------------------
      // Import settings from JSON
      // ------------------------------------------
      case 'import': {
        const { data } = body;
        if (!data) {
          return NextResponse.json(
            { success: false, error: 'data (JSON string) is required' },
            { status: 400 }
          );
        }

        const importResult = deliverySettingsService.importSettings(
          typeof data === 'string' ? data : JSON.stringify(data)
        );

        if (!importResult.success) {
          return NextResponse.json(
            { success: false, errors: importResult.errors },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Settings imported successfully',
          settings: deliverySettingsService.getSettings(),
        });
      }

      // ------------------------------------------
      // Test AI agent output
      // ------------------------------------------
      case 'test-ai': {
        const aiSettings = deliverySettingsService.getSettingsByCategory('ai');
        const agent = new DeliveryAIAgent();

        const sampleDaySummary = {
          totalDeliveries: 3,
          rushOrders: 1,
          urgentOrders: 0,
          cities: ['Huntsville', 'Madison'],
        };

        const greeting = agent.generateGreeting('Test Driver', sampleDaySummary);
        const topic = agent.getConversationTopic();
        const qaResult = agent.answerQuestion('What PPE is required?');

        const sampleTicket = {
          ticketId: 'TEST-001',
          ticketType: 'delivery' as const,
          jobName: 'Sample Job',
          jobAddress: '1482 Oak Valley Dr',
          city: 'Huntsville',
          customerName: 'Mark Henderson',
          customerPhone: '(256) 301-8472',
          materials: [
            { productName: 'Shingles', quantity: 10, unit: 'bundles' },
            { productName: 'Underlayment', quantity: 2, unit: 'rolls' },
          ],
          priority: 'normal' as const,
          status: 'assigned',
        };

        const coaching = agent.generateDeliveryCoaching(sampleTicket);

        return NextResponse.json({
          success: true,
          agentName: aiSettings.agentName,
          personality: aiSettings.agentPersonality,
          testOutput: {
            greeting,
            conversationTopic: topic,
            sampleQA: {
              question: 'What PPE is required?',
              answer: qaResult.answer,
              confidence: qaResult.confidence,
            },
            coachingTipsCount: coaching.length,
            sampleCoachingTip: coaching[0]?.tip || 'No coaching tips generated.',
          },
        });
      }

      // ------------------------------------------
      // Test IoT connection
      // ------------------------------------------
      case 'test-iot': {
        const warehouseSettings = deliverySettingsService.getSettingsByCategory('warehouse');
        const iot = new WarehouseIoTService();

        const isConfigured = iot.isConfigured();

        if (!isConfigured) {
          return NextResponse.json({
            success: true,
            iotEnabled: warehouseSettings.iotEnabled,
            connected: false,
            message: 'IoT not configured. Set HA_ACCESS_TOKEN environment variable to enable.',
            devices: [],
          });
        }

        // Try to get device statuses to test the connection
        try {
          const devices = await iot.getDeviceStatuses();
          const temp = await iot.getWarehouseTemp();

          return NextResponse.json({
            success: true,
            iotEnabled: warehouseSettings.iotEnabled,
            connected: true,
            message: 'Successfully connected to Home Assistant.',
            haBaseUrl: warehouseSettings.haBaseUrl,
            deviceCount: devices.length,
            devices: devices.map(d => ({
              name: d.name,
              state: d.state,
              available: d.available,
            })),
            temperature: temp.state !== 'unavailable' ? `${temp.state}${temp.unit || ''}` : 'Unavailable',
          });
        } catch {
          return NextResponse.json({
            success: true,
            iotEnabled: warehouseSettings.iotEnabled,
            connected: false,
            message: 'Failed to connect to Home Assistant. Check HA_BASE_URL and HA_ACCESS_TOKEN.',
            devices: [],
          });
        }
      }

      // ------------------------------------------
      // Check health of all delivery services
      // ------------------------------------------
      case 'check-health': {
        const services: Array<{
          name: string;
          status: 'healthy' | 'degraded' | 'offline';
          message: string;
        }> = [];

        // AI Agent health
        try {
          const agent = new DeliveryAIAgent();
          const info = agent.getAgentInfo();
          services.push({
            name: 'AI Agent',
            status: 'healthy',
            message: `Agent "${info.name}" operational. Q&A database loaded.`,
          });
        } catch {
          services.push({
            name: 'AI Agent',
            status: 'offline',
            message: 'AI Agent service failed to initialize.',
          });
        }

        // IoT Service health
        try {
          const iot = new WarehouseIoTService();
          if (iot.isConfigured()) {
            services.push({
              name: 'Warehouse IoT',
              status: 'healthy',
              message: 'IoT service configured and ready.',
            });
          } else {
            services.push({
              name: 'Warehouse IoT',
              status: 'degraded',
              message: 'IoT service active but HA_ACCESS_TOKEN not set. IoT features disabled.',
            });
          }
        } catch {
          services.push({
            name: 'Warehouse IoT',
            status: 'offline',
            message: 'IoT service failed to initialize.',
          });
        }

        // Smart Delivery Engine health
        try {
          const engine = new SmartDeliveryEngine();
          // Quick validation check
          const valid = engine.validateStatusTransition('assigned', 'materials_pulled');
          services.push({
            name: 'Smart Delivery Engine',
            status: valid ? 'healthy' : 'degraded',
            message: valid
              ? 'Engine operational. Status flow, routing, and notification systems ready.'
              : 'Engine loaded but status validation returned unexpected result.',
          });
        } catch {
          services.push({
            name: 'Smart Delivery Engine',
            status: 'offline',
            message: 'Smart Delivery Engine failed to initialize.',
          });
        }

        // Settings Service health
        try {
          const settings = deliverySettingsService.getSettings();
          const categoryCount = Object.keys(settings).length;
          services.push({
            name: 'Settings Service',
            status: 'healthy',
            message: `Settings loaded. ${categoryCount} categories configured.`,
          });
        } catch {
          services.push({
            name: 'Settings Service',
            status: 'offline',
            message: 'Settings service failed to load.',
          });
        }

        const overallHealthy = services.every(s => s.status === 'healthy');
        const anyOffline = services.some(s => s.status === 'offline');

        return NextResponse.json({
          success: true,
          overallStatus: anyOffline ? 'degraded' : overallHealthy ? 'healthy' : 'degraded',
          services,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Settings API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
