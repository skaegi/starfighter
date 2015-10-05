/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */

/*eslint-env node */
var licenseKey = null;


if (process.env.VCAP_SERVICES) {
	var parsedVcapServices = JSON.parse(process.env.VCAP_SERVICES);
	
	if (parsedVcapServices['newrelic']) {
		licenseKey = parsedVcapServices['newrelic'][0]['credentials']['licenseKey'];
	}
}

exports.config = {
  /**
   * Array of application names.
   */
  app_name: ['My Application'],
  /**
   * Your New Relic license key.
   */
  license_key: licenseKey,
  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: 'info'
  }
};

