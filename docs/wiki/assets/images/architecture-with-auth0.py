from diagrams import Diagram, Cluster
from diagrams.aws.network import VPC, PublicSubnet, PrivateSubnet, ALB, NATGateway, Route53
from diagrams.aws.compute import EKS
from diagrams.aws.database import ElastiCache, RDS, KeyspacesManagedApacheCassandraService
from diagrams.aws.management import Cloudwatch
from diagrams.aws.security import SecretsManager, WAF
from diagrams.onprem.client import Users
from diagrams.programming.framework import React
from diagrams.k8s.compute import Pod
from diagrams.saas.identity import Auth0  # Import Auth0 from diagrams.saas.identity
import os

# Prompt the user for the output image name
output_name = input("Enter the name of the generated image (without extension): ").strip()
if not output_name:
    # Default to the name of the Python script (without .py extension)
    output_name = os.path.splitext(os.path.basename(__file__))[0]

# Create the diagram
with Diagram("AWS Enterprise Architecture", show=False, filename=output_name):
    # Define the Internet
    with Cluster("Internet"):
        users = Users("Users")
        auth0 = Auth0("Auth0")  # Auth0 resides outside the VPC

    # Define AWS Cloud
    with Cluster("AWS Cloud", graph_attr={"bgcolor": "#F8F9F9"}):
        route53 = Route53("Route 53")
        waf = WAF("AWS WAF")
        cloudwatch = Cloudwatch("CloudWatch")
        secrets_manager = SecretsManager("Secrets Manager")

        with Cluster("VPC", graph_attr={"bgcolor": "#EBF5FB"}):
            # Public Subnets
            with Cluster("Public Subnets", graph_attr={"bgcolor": "#82E0AA"}):
                alb_nextjs = ALB("ALB (NextJS)")
                nat_gateway_az1 = NATGateway("NAT Gateway AZ1")
                nat_gateway_az2 = NATGateway("NAT Gateway AZ2")

            # Private Subnet - Web Tier
            with Cluster("Private Subnet - Web Tier", graph_attr={"bgcolor": "lightblue"}):
                nextjs_portal_az1 = React("Voting Portal AZ1")
                nextjs_portal_az2 = React("Voting Portal AZ2")

            # Private Subnet - App Tier
            with Cluster("Private Subnet - App Tier", graph_attr={"bgcolor": "lightblue"}):
                internal_alb = ALB("Internal ALB (EKS)")
                with Cluster("EKS Cluster", graph_attr={"bgcolor": "#F2F3F4"}):
                    api_pod_1 = Pod("Voting API Pod 1")
                    api_pod_2 = Pod("Voting API Pod 2")
                    api_pod_3 = Pod("Voting API Pod 3")

            # Private Subnet - Data Tier for Redis
            with Cluster("Private Subnet - Redis Data Tier", graph_attr={"bgcolor": "lightblue"}):
                elasticache = ElastiCache("Redis ElastiCache")

            # Private Subnet - Data Tier for RDS
            with Cluster("Private Subnet - RDS Data Tier", graph_attr={"bgcolor": "lightblue"}):
                with Cluster("Database Cluster (RDS)", graph_attr={"bgcolor": "#F2F3F4"}):
                    rds_primary = RDS("RDS Primary")
                    rds_replica_1 = RDS("RDS Replica 1")
                    rds_replica_2 = RDS("RDS Replica 2")

            # Private Subnet - Data Tier for Cassandra
            with Cluster("Private Subnet - Cassandra Data Tier", graph_attr={"bgcolor": "lightblue"}):
                with Cluster("Cassandra Cluster", graph_attr={"bgcolor": "#F2F3F4"}):
                    cassandra_1 = KeyspacesManagedApacheCassandraService("Cassandra Node 1")
                    cassandra_2 = KeyspacesManagedApacheCassandraService("Cassandra Node 2")
                    cassandra_3 = KeyspacesManagedApacheCassandraService("Cassandra Node 3")

        # Connections within AWS Cloud
        users >> route53
        route53 >> waf
        waf >> alb_nextjs
        alb_nextjs >> [nextjs_portal_az1, nextjs_portal_az2]
        nextjs_portal_az1 >> internal_alb
        nextjs_portal_az2 >> internal_alb
        internal_alb >> [api_pod_1, api_pod_2, api_pod_3]
        api_pod_1 >> elasticache
        api_pod_2 >> elasticache
        api_pod_3 >> elasticache
        api_pod_1 >> rds_primary
        api_pod_2 >> cassandra_1
        rds_primary >> [rds_replica_1, rds_replica_2]
        cassandra_1 >> [cassandra_2, cassandra_3]

        # Auth0 Connections
        users >> auth0  # Users authenticate via Auth0
        auth0 >> alb_nextjs  # Auth0 redirects users to the public-facing ALB
        alb_nextjs >> nextjs_portal_az1  # ALB forwards requests to NextJS
        alb_nextjs >> nextjs_portal_az2
        nextjs_portal_az1 >> internal_alb  # NextJS calls EKS via internal ALB
        nextjs_portal_az2 >> internal_alb