# BazaarHub - Deployment & Production Checklist

Complete checklist for deploying BazaarHub to production.

## Pre-Deployment (Week 1-2)

### Security
- [ ] Generate strong JWT_SECRET (min 32 characters)
- [ ] Generate strong ENCRYPTION_KEY (min 32 characters)
- [ ] Update all default passwords in .env
- [ ] Set up database user with minimal permissions
- [ ] Configure CORS whitelist for production domains
- [ ] Set HTTPS_ONLY=true
- [ ] Set SECURE_COOKIES=true
- [ ] Obtain SSL/TLS certificates from Let's Encrypt or CA
- [ ] Configure HSTS headers
- [ ] Run security scanning: `npm audit`
- [ ] Perform dependency vulnerability check
- [ ] Set up Web Application Firewall (WAF) rules
- [ ] Review and harden Nginx configuration

### Infrastructure
- [ ] Provision PostgreSQL 15 server (managed service preferred)
- [ ] Provision Redis 7 server (managed service preferred)
- [ ] Provision Elasticsearch 8 cluster (managed service preferred)
- [ ] Set up S3 buckets (bazaarhub-products, bazaarhub-kyc)
- [ ] Configure S3 bucket encryption (SSE-S3)
- [ ] Set up S3 lifecycle policies (archival/deletion)
- [ ] Create IAM user with S3 access only
- [ ] Set up CloudFront/CDN for S3
- [ ] Configure backup and disaster recovery
- [ ] Set up monitoring (CloudWatch, Datadog, etc.)
- [ ] Configure alerting for critical metrics
- [ ] Set up log aggregation (ELK, Splunk, etc.)
- [ ] Configure DDoS protection
- [ ] Plan capacity and scalability

### Third-Party Services
- [ ] Create Razorpay account (production keys)
- [ ] Configure Razorpay webhook endpoint
- [ ] Whitelist webhook IP in firewall
- [ ] Test Razorpay payments with test cards
- [ ] Create Shiprocket account
- [ ] Test Shiprocket API integration
- [ ] Configure email service (SMTP provider)
- [ ] Test email delivery
- [ ] Configure SMS service (Twilio, AWS SNS, etc.)
- [ ] Test OTP delivery
- [ ] Set up AWS S3 access
- [ ] Configure AWS KMS for encryption keys
- [ ] Test S3 upload/download functionality

### Database
- [ ] Review migrations for production readiness
- [ ] Increase connection pool size (20-50)
- [ ] Enable SSL for database connections
- [ ] Configure automated backups (daily)
- [ ] Test backup and restore procedures
- [ ] Enable query logging for slow query analysis
- [ ] Create indices for frequently queried columns
- [ ] Set up database replication (primary-replica)
- [ ] Configure failover mechanism
- [ ] Review Row-Level Security policies
- [ ] Test vendor data isolation

### Performance
- [ ] Configure Redis for session storage
- [ ] Set up Redis replication
- [ ] Configure Redis persistence (AOF)
- [ ] Tune Elasticsearch for production
- [ ] Set up Elasticsearch cluster (minimum 3 nodes)
- [ ] Configure shard allocation
- [ ] Set up Kibana for log analysis
- [ ] Load test with k6/JMeter
- [ ] Identify and optimize slow endpoints
- [ ] Configure caching headers
- [ ] Enable compression
- [ ] Test with expected traffic volume

### Compliance & Legal
- [ ] Review GST compliance requirements
- [ ] Verify TDS calculation accuracy
- [ ] Confirm KYC document retention policy
- [ ] Review data privacy policy
- [ ] Set up GDPR compliance (if applicable)
- [ ] Configure data retention/deletion policies
- [ ] Document PII handling procedures
- [ ] Prepare audit logs retention plan
- [ ] Review terms of service
- [ ] Verify Razorpay compliance
- [ ] Document compliance procedures

## Deployment (Day 1)

### Pre-Deployment Checks
- [ ] All code committed and pushed
- [ ] All tests passing locally
- [ ] All CI/CD pipelines green
- [ ] Database migrations ready
- [ ] Rollback plan documented
- [ ] Team briefed on deployment process
- [ ] Maintenance window scheduled
- [ ] Stakeholders notified

### Environment Setup
```bash
# Create production .env file with all secrets
cp .env.example .env.production

# Essential variables to set:
# - NODE_ENV=production
# - Database credentials
# - Redis credentials
# - Elasticsearch credentials
# - JWT_SECRET (strong 32+ chars)
# - ENCRYPTION_KEY (strong 32+ chars)
# - Razorpay production keys
# - AWS credentials
# - Email/SMS credentials
# - Domain names
# - SSL certificates
```

### Deployment Steps
- [ ] Build Docker images: `docker-compose build --no-cache`
- [ ] Push images to registry
- [ ] Deploy backend service
- [ ] Deploy storefront service
- [ ] Deploy vendor-panel service
- [ ] Deploy admin-panel service
- [ ] Deploy Nginx reverse proxy
- [ ] Configure SSL certificates
- [ ] Verify all services are running
- [ ] Check service logs for errors
- [ ] Verify database migrations ran
- [ ] Test API endpoints
- [ ] Test vendor registration flow
- [ ] Test KYC submission
- [ ] Test payment processing

### DNS & Domain Configuration
- [ ] Update DNS records (A, CNAME)
- [ ] Wait for DNS propagation
- [ ] Verify domain resolution
- [ ] Test HTTPS on all domains
- [ ] Set up SSL certificate auto-renewal

### Post-Deployment Verification
- [ ] Health checks passing
- [ ] All services responsive
- [ ] Database connectivity confirmed
- [ ] Cache connectivity confirmed
- [ ] Search connectivity confirmed
- [ ] S3 connectivity confirmed
- [ ] Email delivery working
- [ ] SMS delivery working
- [ ] Razorpay sandbox payments working
- [ ] Logs being written correctly
- [ ] Monitoring and alerting active
- [ ] Backups running successfully

## Post-Deployment (Week 1)

### Smoke Tests (Day 1)
- [ ] Test user registration
- [ ] Test vendor registration
- [ ] Test email verification
- [ ] Test phone OTP
- [ ] Test KYC document upload
- [ ] Test admin KYC approval
- [ ] Test product creation
- [ ] Test product search
- [ ] Test order creation
- [ ] Test payment processing (test card)
- [ ] Test order confirmation email
- [ ] Test shipping integration
- [ ] Test vendor dashboard access
- [ ] Test admin dashboard access
- [ ] Test report generation
- [ ] Test payout scheduling

### Performance Monitoring
- [ ] Monitor CPU usage
- [ ] Monitor memory usage
- [ ] Monitor disk space
- [ ] Monitor database performance
- [ ] Monitor API response times
- [ ] Monitor error rates
- [ ] Identify slow endpoints
- [ ] Monitor Redis hit rates
- [ ] Monitor Elasticsearch query times
- [ ] Check for memory leaks
- [ ] Monitor concurrent users

### Security Monitoring
- [ ] Monitor for suspicious login attempts
- [ ] Monitor KYC verification activity
- [ ] Check rate limiting is working
- [ ] Monitor encryption key usage
- [ ] Review audit logs
- [ ] Monitor for unauthorized access
- [ ] Check SSL/TLS certificate validity
- [ ] Monitor for data exfiltration attempts
- [ ] Review API access logs

### Operational Monitoring
- [ ] Monitor service availability
- [ ] Monitor backup completion
- [ ] Monitor log aggregation
- [ ] Monitor alert system
- [ ] Review error logs
- [ ] Check for failed jobs/cron tasks
- [ ] Monitor external API integrations
- [ ] Verify failover mechanisms
- [ ] Test incident response procedures

## Ongoing Maintenance

### Daily Tasks
- [ ] Review error logs
- [ ] Check service health
- [ ] Monitor database performance
- [ ] Review security alerts
- [ ] Check backup completion
- [ ] Monitor disk space
- [ ] Review rate limiting statistics
- [ ] Check for failed payments

### Weekly Tasks
- [ ] Review performance metrics
- [ ] Analyze user behavior
- [ ] Check vendor KYC submissions
- [ ] Review payment reconciliation
- [ ] Generate payout reports
- [ ] Review commission calculations
- [ ] Check product certifications
- [ ] Monitor Elasticsearch indices
- [ ] Test disaster recovery plan
- [ ] Update dependency security patches

### Monthly Tasks
- [ ] Full database backup and restore test
- [ ] Security vulnerability scan
- [ ] Review and update security policies
- [ ] Analyze traffic patterns
- [ ] Capacity planning review
- [ ] Performance optimization review
- [ ] Compliance audit
- [ ] User feedback review
- [ ] Update disaster recovery plan
- [ ] Review and rotate secrets

### Quarterly Tasks
- [ ] Full security audit
- [ ] Load testing with current traffic
- [ ] Database optimization
- [ ] API performance review
- [ ] Cost optimization review
- [ ] Scalability assessment
- [ ] Compliance review
- [ ] Architecture review
- [ ] Backup integrity verification
- [ ] DR plan execution test

## Monitoring & Alerting Setup

### Critical Alerts
```
- API response time > 5 seconds
- Error rate > 1%
- Database connection pool exhausted
- Redis connection failed
- Elasticsearch cluster unhealthy
- Disk space < 10%
- Memory usage > 80%
- CPU usage > 80%
- Payment gateway failure
- Email delivery failure
- S3 connectivity loss
```

### Metrics to Monitor
- API request rate
- API error rate
- API response time (p50, p95, p99)
- Database query time
- Database slow queries
- Redis memory usage
- Redis hit rate
- Elasticsearch query time
- Elasticsearch index size
- Server CPU usage
- Server memory usage
- Disk I/O
- Network I/O
- Payment success rate
- KYC verification rate
- User registration rate
- Order completion rate

## Rollback Plan

### If Critical Issues Detected
1. Stop accepting new traffic (via Nginx)
2. Stop new processes/jobs
3. Assess issue severity
4. If minor: hotfix and redeploy
5. If major: rollback to previous version

### Rollback Steps
```bash
# Stop current deployment
docker-compose down

# Switch to previous tag
git checkout <previous-tag>

# Rebuild and redeploy
docker-compose up -d

# Verify functionality
curl http://api/health

# Notify stakeholders
```

## Documentation to Maintain

- [ ] Architecture diagram updated
- [ ] API documentation updated
- [ ] Database schema documented
- [ ] Deployment procedures documented
- [ ] Runbook for common issues created
- [ ] Disaster recovery procedures documented
- [ ] Security policies documented
- [ ] Compliance documentation updated

## Team Training

- [ ] Incident response procedures
- [ ] Deployment procedures
- [ ] Rollback procedures
- [ ] Monitoring and alerting
- [ ] Database management
- [ ] Performance troubleshooting
- [ ] Security best practices
- [ ] Customer support procedures

## Budget & Cost Management

### Infrastructure Costs to Monitor
- [ ] PostgreSQL database (RDS/managed service)
- [ ] Redis cluster (ElastiCache/managed service)
- [ ] Elasticsearch cluster (OpenSearch/managed service)
- [ ] S3 storage and data transfer
- [ ] CloudFront/CDN costs
- [ ] EC2/compute instances
- [ ] Load balancer costs
- [ ] Backup storage costs
- [ ] Monitoring service costs
- [ ] Email/SMS costs

### Cost Optimization
- [ ] Right-size database instances
- [ ] Use reserved instances for predictable workloads
- [ ] Enable S3 lifecycle policies
- [ ] Optimize CloudFront caching
- [ ] Review data transfer costs
- [ ] Monitor unused resources

## Success Criteria

✅ All health checks passing
✅ All services responsive
✅ Response times < 2 seconds (p95)
✅ Error rate < 0.5%
✅ Zero critical security issues
✅ All payment integrations working
✅ Database backups succeeding
✅ Logs being aggregated
✅ Monitoring and alerting active
✅ Team trained and ready
✅ Documentation complete
✅ Runbooks tested
✅ DR plan tested
✅ User feedback positive

## Post-Launch Review (Week 4)

- [ ] Conduct post-mortem meeting
- [ ] Review any issues encountered
- [ ] Identify improvements for next release
- [ ] Update documentation based on learnings
- [ ] Optimize performance based on real traffic
- [ ] Adjust alerting thresholds based on actual metrics
- [ ] Plan for next improvements
- [ ] Archive deployment logs and documentation

---

**Status**: ⚠️ PENDING DEPLOYMENT

**Last Updated**: [Current Date]

**Next Review Date**: [+30 days]
