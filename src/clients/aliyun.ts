import * as $OpenApi from '@alicloud/openapi-client';
import ECS from '@alicloud/ecs20140526';
import BssOpenApi, { QueryInstanceBillRequest, QueryBillOverviewRequest } from '@alicloud/bssopenapi20171214'; 
import dotenv from 'dotenv';

dotenv.config();

const {
  ALIBABA_CLOUD_ACCESS_KEY_ID,
  ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  ALIBABA_CLOUD_REGION = 'cn-beijing'
} = process.env;

if (!ALIBABA_CLOUD_ACCESS_KEY_ID || !ALIBABA_CLOUD_ACCESS_KEY_SECRET) {
  throw new Error('Missing required Alibaba Cloud credentials in environment variables');
}

export function createEcsClient() {
  try {
    const config = new $OpenApi.Config({
      accessKeyId: ALIBABA_CLOUD_ACCESS_KEY_ID,
      accessKeySecret: ALIBABA_CLOUD_ACCESS_KEY_SECRET,
      endpoint: `ecs.${ALIBABA_CLOUD_REGION}.aliyuncs.com`
    });
    
    return new ECS(config);
  } catch (error) {
    console.error('Error creating Aliyun client:', error);
    throw error;
  }
}

// Type definition for the detailed aggregated billing data structure
type DetailedBillingValues = {
  original: number; // Original amount (PretaxGrossAmount)
  discount: number; // Total discounts applied
  actual: number;   // Actual amount paid (Original - Discount)
};
type AggregatedBillingData = {
  [date: string]: {
    [productCode: string]: DetailedBillingValues
  }
};

// Function to generate HTML report from detailed billing data
export function generateBillingHtmlReport(billingData: AggregatedBillingData): string {
  let tableRows = '';
  let overallTotalOriginal = 0;
  let overallTotalDiscount = 0;
  let overallTotalActual = 0;

  // Sort dates
  const sortedDates = Object.keys(billingData).sort();

  for (const date of sortedDates) {
    const products = billingData[date];
    const sortedProducts = Object.keys(products).sort();
    let dateTotalOriginal = 0;
    let dateTotalDiscount = 0;
    let dateTotalActual = 0;
    let isFirstRowForDate = true;

    for (const productCode of sortedProducts) {
      const values = products[productCode];
      dateTotalOriginal += values.original;
      dateTotalDiscount += values.discount;
      dateTotalActual += values.actual;
      tableRows += `
        <tr class="border-b hover:bg-gray-50">
          ${isFirstRowForDate ? `<td class="p-2 border-r align-top">${date}</td>` : '<td class="p-2 border-r"></td>'}
          <td class="p-2 border-r align-top">${productCode}</td>
          <td class="p-2 text-right align-top">${values.original.toFixed(4)}</td>
          <td class="p-2 text-right align-top">${values.discount.toFixed(4)}</td>
          <td class="p-2 text-right align-top">${values.actual.toFixed(4)}</td>
        </tr>
      `;
      isFirstRowForDate = false;
    }
     // Add a subtotal row for the date
     tableRows += `
     <tr class="bg-gray-100 font-semibold">
       <td class="p-2 border-r text-right" colspan="2">Total for ${date}:</td>
       <td class="p-2 text-right">${dateTotalOriginal.toFixed(4)}</td>
       <td class="p-2 text-right">${dateTotalDiscount.toFixed(4)}</td>
       <td class="p-2 text-right">${dateTotalActual.toFixed(4)}</td>
     </tr>
   `;
    overallTotalOriginal += dateTotalOriginal;
    overallTotalDiscount += dateTotalDiscount;
    overallTotalActual += dateTotalActual;
  }

  // Add overall total row
  tableRows += `
    <tr class="bg-gray-200 font-bold text-lg">
      <td class="p-2 border-r text-right" colspan="2">Overall Total:</td>
      <td class="p-2 text-right">${overallTotalOriginal.toFixed(4)}</td>
      <td class="p-2 text-right">${overallTotalDiscount.toFixed(4)}</td>
      <td class="p-2 text-right">${overallTotalActual.toFixed(4)}</td>
    </tr>
  `;

  // Construct the full HTML page
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aliyun Billing Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 p-8">
    <div class="container mx-auto bg-white p-6 rounded shadow-lg">
        <h1 class="text-2xl font-bold mb-4">Aliyun Billing Report</h1>
        <table class="w-full table-auto border-collapse border border-gray-300">
            <thead>
                <tr class="bg-gray-200">
                    <th class="p-2 border-r">Date</th>
                    <th class="p-2 border-r">Product Code</th>
                    <th class="p-2 text-right border-r">Original Amount</th>
                    <th class="p-2 text-right border-r">Discount</th>
                    <th class="p-2 text-right">Actual Amount</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
</body>
</html>
  `;

  return htmlContent;
}

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Function to get billing details for the last N days
export async function getBillingDetails(days: number = 7) {
  if (days < 1 || days > 30) {
    throw new Error('Days parameter must be between 1 and 30.');
  }

  const client = createBillingClient();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days + 1); // Inclusive start date

  const startMonthStr = startDate.getFullYear() + '-' + (startDate.getMonth() + 1).toString().padStart(2, '0');
  const endMonthStr = endDate.getFullYear() + '-' + (endDate.getMonth() + 1).toString().padStart(2, '0');

  const billingCycles = new Set<string>();
  billingCycles.add(startMonthStr);
  billingCycles.add(endMonthStr);

  let allItems: any[] = [];
  // Removed debug logging variables
  
  try {
    // Loop through each date in the range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d); // Create a new Date object to avoid mutation issues
      const billingDateStr = formatDate(currentDate);
      const billingCycleStr = currentDate.getFullYear() + '-' + (currentDate.getMonth() + 1).toString().padStart(2, '0');
      
      let nextToken: string | undefined = undefined;
      let pageNum = 1;
      do {
        const request = new QueryInstanceBillRequest({
          billingCycle: billingCycleStr,
          billingDate: billingDateStr, // Specify the exact date
          granularity: 'DAILY',
          isBillingItem: false, // As per last user change
          pageSize: 300, 
          nextToken: nextToken,
        });
        
        try {
          const response = await client.queryInstanceBill(request);
          const items = response.body?.data?.items?.item;
          if (items && items.length > 0) {
            allItems = allItems.concat(items);
          } else {
             // Optionally log if no items found, but keeping it minimal now
          }
          nextToken = response.body?.data?.nextToken;
        } catch (dailyError) {
           console.error(`Error fetching data for date ${billingDateStr}, page ${pageNum}:`, dailyError);
           nextToken = undefined; // Stop pagination for this date on error
        }
        pageNum++;
      } while (nextToken);
    } // End of date loop

    // No need to filter by date anymore as we fetched specific dates
    // Aggregate results by date and product code with detailed fields
    const aggregatedData: AggregatedBillingData = {};

    // Use allItems directly as they should already be within the date range
    for (const item of allItems) {
      // Removed debug logging block

      const date = item.billingDate;
      const productCode = item.productCode || 'UnknownProduct';

      // Extract relevant amounts, defaulting to 0 if null/undefined
      const originalAmount = item.pretaxGrossAmount || 0;
      const invoiceDiscount = item.invoiceDiscount || 0;
      const couponDiscount = item.deductedByCoupons || 0;
      const cashCouponDiscount = item.deductedByCashCoupons || 0;
      const prepaidCardDiscount = item.deductedByPrepaidCard || 0;
      // const paymentAmount = item.paymentAmount || 0; // Not directly used in calculation below

      // Calculate total discount
      const totalDiscount = invoiceDiscount + couponDiscount + cashCouponDiscount + prepaidCardDiscount;
      // Calculate actual amount
      const actualAmount = originalAmount - totalDiscount;

      if (!aggregatedData[date]) {
        aggregatedData[date] = {};
      }
      if (!aggregatedData[date][productCode]) {
        aggregatedData[date][productCode] = {
          original: 0,
          discount: 0,
          actual: 0
        };
      }

      // Sum the detailed values
      aggregatedData[date][productCode].original += originalAmount;
      aggregatedData[date][productCode].discount += totalDiscount;
      aggregatedData[date][productCode].actual += actualAmount;
    }

    return aggregatedData;

  } catch (error) {
    console.error('Error fetching or processing billing details:', error);
    throw new Error(`Failed to get billing details: ${error instanceof Error ? error.message : error}`);
  }
}

// New function to create a client for the Billing Service (BSS Open API)
export function createBillingClient() {
  try {
    const config = new $OpenApi.Config({
      accessKeyId: ALIBABA_CLOUD_ACCESS_KEY_ID,
      accessKeySecret: ALIBABA_CLOUD_ACCESS_KEY_SECRET,
      // BSS Open API uses a global endpoint
      endpoint: 'business.aliyuncs.com' 
    });
    
    return new BssOpenApi(config);
  } catch (error) {
    console.error('Error creating Aliyun Billing client:', error);
    throw error;
  }
}
