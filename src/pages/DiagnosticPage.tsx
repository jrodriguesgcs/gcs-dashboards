import { useEffect, useState } from 'react'

interface DiagnosticResult {
  timestamp: string
  environment: any
  tests: Record<string, any>
  summary: any
}

export default function DiagnosticPage() {
  const [results, setResults] = useState<DiagnosticResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    runDiagnostics()
  }, [])

  const runDiagnostics = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Starting diagnostics...')
      
      // Test API endpoints
      const endpoints = [
        '/api/diagnostic-enhanced',
        '/api/test-basic',
        '/api/test-db-connection',
        '/api/test-tables',
        '/api/health', 
        '/api/sales?pathname=/meta',
        '/api/sdr?pathname=/meta',
        '/api/marketing'
      ]
      
      const endpointResults: Record<string, any> = {}
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Testing ${endpoint}...`)
          const response = await fetch(endpoint)
          const data = await response.json()
          
          endpointResults[endpoint] = {
            status: response.status,
            ok: response.ok,
            data: data
          }
        } catch (e: any) {
          console.error(`Error testing ${endpoint}:`, e)
          endpointResults[endpoint] = {
            status: 'ERROR',
            error: e.message
          }
        }
      }
      
      // Try to get main diagnostic data
      const mainResponse = await fetch('/api/diagnostic-enhanced')
      if (mainResponse.ok) {
        const diagnosticData = await mainResponse.json()
        setResults({
          ...diagnosticData,
          endpointTests: endpointResults
        } as any)
      } else {
        throw new Error(`Diagnostic endpoint failed: ${mainResponse.status}`)
      }
      
    } catch (e: any) {
      console.error('Diagnostic error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card pad">
        <h2>Running Diagnostics...</h2>
        <p>Please wait while we test all systems...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card pad" style={{border: '2px solid #f66', background: '#fff5f5'}}>
        <h2 style={{color: '#b00020'}}>Diagnostic Error</h2>
        <p>Failed to run diagnostics: {error}</p>
        <button className="btn primary" onClick={runDiagnostics}>
          Retry Diagnostics
        </button>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="card pad">
        <h2>No Results</h2>
        <p>No diagnostic results available.</p>
        <button className="btn primary" onClick={runDiagnostics}>
          Run Diagnostics
        </button>
      </div>
    )
  }

  return (
    <div className="grid" style={{gap: 12}}>
      <div className="card pad">
        <h1>System Diagnostics</h1>
        <p>Last run: {results.timestamp}</p>
        <div className={`card pad ${results.summary?.overallHealth === 'HEALTHY' ? 'success' : 'warning'}`}>
          <h3>Overall Health: {results.summary?.overallHealth || 'UNKNOWN'}</h3>
          <p>Tests passed: {results.summary?.successfulTests || 0} / {results.summary?.totalTests || 0}</p>
        </div>
      </div>

      {/* Environment */}
      <div className="card pad">
        <h2>Environment</h2>
        <pre style={{background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto'}}>
          {JSON.stringify(results.environment, null, 2)}
        </pre>
      </div>

      {/* Individual Tests */}
      <div className="card pad">
        <h2>Individual Tests</h2>
        {Object.entries(results.tests || {}).map(([testName, testResult]: [string, any]) => (
          <div key={testName} className={`card pad ${testResult.success ? 'success' : 'error'}`} style={{marginBottom: '12px'}}>
            <h3>{testName}: {testResult.success ? '✅ PASS' : '❌ FAIL'}</h3>
            {testResult.error && (
              <div style={{color: 'red', fontSize: '14px', marginTop: '8px'}}>
                <strong>Error:</strong> {testResult.error}
              </div>
            )}
            {testResult.details && (
              <div style={{marginTop: '8px'}}>
                <strong>Details:</strong>
                <pre style={{background: '#f9f9f9', padding: '8px', borderRadius: '4px', fontSize: '12px', overflow: 'auto'}}>
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Endpoint Tests */}
      {(results as any).endpointTests && (
        <div className="card pad">
          <h2>API Endpoint Tests</h2>
          {Object.entries((results as any).endpointTests).map(([endpoint, result]: [string, any]) => (
            <div key={endpoint} className={`card pad ${result.ok ? 'success' : 'error'}`} style={{marginBottom: '12px'}}>
              <h3>{endpoint}</h3>
              <p><strong>Status:</strong> {result.status}</p>
              {result.error && <p style={{color: 'red'}}><strong>Error:</strong> {result.error}</p>}
              {result.data && (
                <details>
                  <summary>Response Data</summary>
                  <pre style={{background: '#f9f9f9', padding: '8px', borderRadius: '4px', fontSize: '12px', overflow: 'auto'}}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card pad">
        <button className="btn primary" onClick={runDiagnostics}>
          Re-run Diagnostics
        </button>
      </div>
    </div>
  )
}