import fetch from 'node-fetch';

async function testOnlineReceivedCashGivenAPI() {
  const testData = {
    entryType: 'ONLINE_RECEIVED_CASH_GIVEN',
    data: {
      receivedOnlineAmount: 1000,
      cashGiven: 950,
      receivedOnlineFrom: 'Shop',
      moneyDistributionType: 'Full Amount given by One Person',
      howMoneyGivenSingle: 'Cash from Gala',
      howMoneyGivenSinglePersonName: '',
      firstPartMoneyGiven: 'Cash from Gala',
      firstPartMoneyGivenPersonName: '',
      firstPartAmount: 0,
      remainingPartMoneyGiven: 'Cash from Gala',
      remainingPartMoneyGivenPersonName: '',
      remainingPartAmount: 0,
      remarks: 'Test entry'
    }
  };

  try {
    console.log('Testing OnlineReceivedCashGiven API...');
    console.log('Sending data:', JSON.stringify(testData, null, 2));

    const response = await fetch('http://localhost:5000/api/data/sales-entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: You'll need to add a valid token here if authentication is required
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify(testData)
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (response.ok) {
      console.log('✅ API call successful!');
    } else {
      console.log('❌ API call failed');
    }
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testOnlineReceivedCashGivenAPI();